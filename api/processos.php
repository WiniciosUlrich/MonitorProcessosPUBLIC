<?php
/**
 * API de Processos - Integração Python
 * Chama o script Python para coleta de processos
 * Author: Sistema de Monitoramento FINAL
 * Date: 15 de junho de 2025
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-cache, must-revalidate');

class ProcessCollector {
    
    private $pythonScript;
    private $pythonCommand;
    
    public function __construct() {
        $this->pythonScript = __DIR__ . '/../python/coletor_processos.py';
        $this->pythonCommand = $this->detectPythonCommand();
    }
    
    /**
     * Detecta o comando Python disponível no sistema
     */
    private function detectPythonCommand() {
        $commands = ['python', 'python3', 'py'];
        
        foreach ($commands as $cmd) {
            $output = shell_exec($cmd . ' --version 2>&1');
            if ($output && strpos(strtolower($output), 'python') !== false) {
                return $cmd;
            }
        }
        
        return 'python'; // Fallback
    }
      /**
     * Coleta processos usando o script Python
     */
    public function getProcesses($maxProcesses = 50, $expand = null) {
        try {
            if (!file_exists($this->pythonScript)) {
                throw new Exception('Script Python não encontrado: ' . $this->pythonScript);
            }
            
            $startTime = microtime(true);
            
            // Executar script Python
            $command = sprintf(
                '%s %s --max %d --json',
                $this->pythonCommand,
                escapeshellarg($this->pythonScript),
                (int)$maxProcesses
            );
            
            // Se for para expandir um grupo específico, adicionar parâmetro
            if ($expand !== null) {
                $command .= sprintf(' --expand %d', (int)$expand);
            }
            
            $command .= ' 2>&1';
            
            $output = shell_exec($command);
            $execTime = round((microtime(true) - $startTime) * 1000, 2);
            
            if (empty($output)) {
                throw new Exception('Script Python não retornou dados');
            }
            
            // Decodificar JSON
            $data = json_decode($output, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception('JSON inválido do Python: ' . json_last_error_msg() . "\nOutput: " . substr($output, 0, 500));
            }
            
            if (!$data || !isset($data['success'])) {
                throw new Exception('Formato de resposta inválido do Python');
            }
            
            if (!$data['success']) {
                throw new Exception('Python retornou erro: ' . ($data['error'] ?? 'desconhecido'));
            }
            
            // Adicionar informações da API PHP
            $data['api_info'] = [
                'php_execution_time_ms' => $execTime,
                'python_command' => $this->pythonCommand,
                'total_time_ms' => ($data['execution_time_ms'] ?? 0) + $execTime,
                'version' => '1.0-python-integration'
            ];
            
            return $data;
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'timestamp' => time(),
                'source' => 'PHP API',
                'processos' => [],
                'estatisticas' => [
                    'total_processos' => 0,
                    'memoria_total_mb' => 0,
                    'cpu_media' => 0,
                    'processos_executando' => 0,
                    'processos_aguardando' => 0
                ]
            ];
        }
    }
    
    /**
     * Termina um processo usando o script Python
     */
    public function killProcess($pid) {
        try {
            if (!file_exists($this->pythonScript)) {
                throw new Exception('Script Python não encontrado');
            }
            
            $pid = (int)$pid;
            if ($pid <= 0) {
                throw new Exception('PID inválido');
            }
            
            // Executar script Python para matar processo
            $command = sprintf(
                '%s %s --kill %d --json 2>&1',
                $this->pythonCommand,
                escapeshellarg($this->pythonScript),
                $pid
            );
            
            $output = shell_exec($command);
            
            if (empty($output)) {
                throw new Exception('Script Python não retornou resposta');
            }
            
            $data = json_decode($output, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception('Resposta inválida do Python: ' . json_last_error_msg());
            }
            
            return $data;
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'pid' => $pid ?? null,
                'timestamp' => time()
            ];
        }
    }
}

// ===============================================
// EXECUÇÃO DA API
// ===============================================

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$collector = new ProcessCollector();

try {
    if ($method === 'GET') {
        // Listar processos
        $maxProcesses = (int)($_GET['max'] ?? 50);
        $maxProcesses = min($maxProcesses, 200); // Limitar máximo
        
        $expand = isset($_GET['expand']) ? (int)$_GET['expand'] : null;
        
        $result = $collector->getProcesses($maxProcesses, $expand);
        
    } elseif ($method === 'POST') {
        // Operações POST (kill process)
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || !isset($input['action'])) {
            throw new Exception('Ação não especificada');
        }
        
        switch ($input['action']) {
            case 'kill':
                if (!isset($input['pid'])) {
                    throw new Exception('PID não especificado');
                }
                $result = $collector->killProcess($input['pid']);
                break;
                
            default:
                throw new Exception('Ação não reconhecida: ' . $input['action']);
        }
        
    } else {
        throw new Exception('Método HTTP não suportado: ' . $method);
    }
    
    // Retornar resultado
    http_response_code(200);
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Erro da API: ' . $e->getMessage(),
        'method' => $method,
        'timestamp' => time()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
?>
