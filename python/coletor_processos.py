#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Monitor de Processos - Coletor Python
Coleta informações detalhadas de todos os processos do sistema
Author: Sistema de Monitoramento
Date: 15 de junho de 2025
"""

import psutil
import json
import sys
import time
from datetime import datetime
import argparse

def get_process_state(process):
    """
    Determina o estado do processo baseado no status do psutil
    Mapeia para os estados padrão do sistema operacional
    """
    try:
        status = process.status()
        
        # Mapeamento dos status do psutil para estados do sistema operacional
        state_mapping = {
            psutil.STATUS_RUNNING: "Executando",        # Processo atualmente executando
            psutil.STATUS_SLEEPING: "Esperando",        # Processo dormindo/aguardando I/O
            psutil.STATUS_DISK_SLEEP: "Esperando",      # Aguardando operação de disco
            psutil.STATUS_STOPPED: "Finalizado",        # Processo parado
            psutil.STATUS_TRACING_STOP: "Finalizado",   # Parado para debugging
            psutil.STATUS_ZOMBIE: "Finalizado",         # Processo zumbi (finalizado mas não limpo)
            psutil.STATUS_DEAD: "Finalizado",           # Processo morto
            psutil.STATUS_IDLE: "Pronto",              # Processo idle/ocioso
            psutil.STATUS_LOCKED: "Esperando",         # Processo bloqueado
            psutil.STATUS_WAITING: "Esperando"         # Processo aguardando
        }
        
        # Para Windows, adicionar estados específicos se existirem
        if hasattr(psutil, 'STATUS_SUSPENDED'):
            state_mapping[psutil.STATUS_SUSPENDED] = "Esperando"     # Processo suspenso
        if hasattr(psutil, 'STATUS_WAKE_KILL'):
            state_mapping[psutil.STATUS_WAKE_KILL] = "Finalizado"    # Sendo finalizado
        if hasattr(psutil, 'STATUS_WAKING'):
            state_mapping[psutil.STATUS_WAKING] = "Pronto"          # Acordando/pronto
        
        # Lógica adicional para melhor detecção de estados
        mapped_state = state_mapping.get(status, "Pronto")
        
        # Se CPU é 0 por muito tempo, pode estar esperando
        try:
            cpu_percent = process.cpu_percent()
            if cpu_percent == 0.0 and mapped_state == "Executando":
                # Verificar se tem I/O ativo
                io_counters = process.io_counters()
                if io_counters.read_count == 0 and io_counters.write_count == 0:
                    return "Pronto"  # Processo idle/pronto
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
            
        return mapped_state
        
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return "Desconhecido"

def get_process_priority(process):
    """
    Obtém a prioridade do processo
    """
    try:
        nice = process.nice()
        
        # Mapeamento de prioridades do Windows
        if sys.platform == "win32":
            priority_mapping = {
                -20: "Tempo Real",
                -10: "Alta",
                0: "Normal", 
                10: "Abaixo do Normal",
                20: "Baixa"
            }
            
            # Encontrar a prioridade mais próxima
            closest_priority = min(priority_mapping.keys(), key=lambda x: abs(x - nice))
            return priority_mapping[closest_priority]
        else:
            # Para sistemas Unix-like
            if nice < -10:
                return "Muito Alta"
            elif nice < 0:
                return "Alta"
            elif nice == 0:
                return "Normal"
            elif nice < 10:
                return "Baixa"
            else:
                return "Muito Baixa"
                
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return "Normal"

def format_memory(bytes_value):
    """
    Formata bytes para MB com 1 casa decimal
    """
    if bytes_value is None or bytes_value == 0:
        return 0.0
    return round(bytes_value / (1024 * 1024), 1)

def get_process_category(name):
    """
    Categoriza o processo baseado no nome
    """
    name_lower = name.lower()
    
    # Processos do sistema
    system_processes = ['system', 'kernel', 'csrss', 'winlogon', 'services', 'lsass', 
                       'dwm', 'smss', 'wininit', 'svchost', 'audiodg']
    
    # Navegadores
    browsers = ['chrome', 'firefox', 'edge', 'opera', 'brave', 'safari', 'iexplore']
    
    # Ferramentas de desenvolvimento
    dev_tools = ['code', 'devenv', 'pycharm', 'intellij', 'notepad++', 'atom', 'sublime']
    
    # Verificar categorias
    for sys_proc in system_processes:
        if sys_proc in name_lower:
            return "Sistema"
    
    for browser in browsers:
        if browser in name_lower:
            return "Navegador"
    
    for dev in dev_tools:
        if dev in name_lower:
            return "Desenvolvimento"
    
    return "Aplicacao"

def collect_processes(max_processes=100, expand_group=None):
    """
    Coleta informações de todos os processos do sistema
    Se expand_group for especificado, retorna todos os processos sem agrupamento
    """
    processes_data = []
    start_time = time.time()
    
    try:# Obter todos os processos
        all_processes = []
        for proc in psutil.process_iter(['pid', 'name', 'status', 'memory_info', 
                                       'cpu_percent', 'num_threads', 'nice', 'create_time', 'ppid']):
            try:
                all_processes.append(proc)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        # Calcular CPU para todos os processos (necessário para medição precisa)
        for proc in all_processes:
            try:
                proc.cpu_percent()  # Primeira chamada para inicializar
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        # Aguardar um pouco para medição mais precisa do CPU
        time.sleep(0.1)
        
        # Coletar dados detalhados
        for proc in all_processes:
            try:
                proc_info = proc.info
                
                # Obter informações de memória
                memory_info = proc_info.get('memory_info')
                memory_mb = format_memory(memory_info.rss if memory_info else 0)
                
                # CPU atual
                try:
                    cpu_percent = proc.cpu_percent()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    cpu_percent = 0.0
                
                # Tempo de execução
                create_time = proc_info.get('create_time', time.time())
                uptime = int(time.time() - create_time)
                  # Construir objeto do processo
                process_data = {
                    'pid': proc_info['pid'],
                    'ppid': proc_info.get('ppid', 0),  # Process Parent ID
                    'nome': proc_info['name'] or 'Desconhecido',
                    'estado': get_process_state(proc),
                    'memoria': memory_mb,
                    'memoria_fisica': memory_mb,
                    'cpu': round(cpu_percent, 1),
                    'threads': proc_info.get('num_threads', 1),
                    'prioridade': get_process_priority(proc),
                    'tempo_execucao': uptime,
                    'categoria': get_process_category(proc_info['name'] or ''),
                    'pode_matar': proc_info['pid'] > 4,  # Processos críticos têm PID baixo
                    'is_parent': False,  # Será definido durante o agrupamento
                    'children_count': 0,  # Contador de filhos
                    'children': []  # Lista de processos filhos (apenas PIDs)
                }
                
                processes_data.append(process_data)
                
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue        # Se expand_group for especificado, retornar todos os processos filhos do grupo
        if expand_group is not None:
            # Encontrar todos os processos que pertencem ao grupo do processo especificado
            target_process_name = None
            for proc in processes_data:
                if proc['pid'] == expand_group:
                    target_process_name = proc['nome'].lower()
                    break
            
            if target_process_name:
                # Filtrar apenas processos do mesmo nome (grupo)
                group_processes = [proc for proc in processes_data if proc['nome'].lower() == target_process_name]
                
                # Ordenar por PID para melhor visualização
                group_processes.sort(key=lambda x: x['pid'])
                
                final_processes = group_processes
            else:
                # Se não encontrar o processo, retornar vazio
                final_processes = []
        else:
            # Agrupar processos por nome (como no Gerenciador de Tarefas)
            grouped_processes = {}
            for proc in processes_data:
                nome_base = proc['nome'].lower()
                
                if nome_base not in grouped_processes:
                    grouped_processes[nome_base] = {
                        'main_process': proc,
                        'children': [],
                        'total_memory': proc['memoria'],
                        'total_cpu': proc['cpu'],
                        'total_threads': proc['threads']
                    }
                    proc['is_parent'] = True
                else:
                    # Adicionar como filho
                    grouped_processes[nome_base]['children'].append(proc)
                    grouped_processes[nome_base]['total_memory'] += proc['memoria']
                    grouped_processes[nome_base]['total_cpu'] += proc['cpu']
                    grouped_processes[nome_base]['total_threads'] += proc['threads']
                    
                    # Atualizar contador no processo principal
                    grouped_processes[nome_base]['main_process']['children_count'] = len(grouped_processes[nome_base]['children'])
                    grouped_processes[nome_base]['main_process']['children'] = [child['pid'] for child in grouped_processes[nome_base]['children']]
            
            # Criar lista final com apenas processos principais (agrupados)
            final_processes = []
            for group_name, group_data in grouped_processes.items():
                main_proc = group_data['main_process']
                
                # Se tem filhos, mostrar totais agregados
                if group_data['children']:
                    main_proc['memoria_total_grupo'] = round(group_data['total_memory'], 1)
                    main_proc['cpu_total_grupo'] = round(group_data['total_cpu'], 1)
                    main_proc['threads_total_grupo'] = group_data['total_threads']
                    main_proc['nome_grupo'] = f"{main_proc['nome']} ({len(group_data['children']) + 1} processos)"
                
                final_processes.append(main_proc)
            
            # Ordenar por uso de memória (decrescente)
            final_processes.sort(key=lambda x: x.get('memoria_total_grupo', x['memoria']), reverse=True)
            
            # Limitar quantidade se especificado
            if max_processes > 0:
                final_processes = final_processes[:max_processes]
        
        processes_data = final_processes
          # Calcular estatísticas do sistema (como no Gerenciador de Tarefas)
        total_processes_listed = len(processes_data)
        running_count = len([p for p in processes_data if p['estado'] == 'Executando'])
        
        # Obter estatísticas reais do sistema
        memory_info = psutil.virtual_memory()
        
        # CPU do sistema (não dos processos individuais) - intervalo maior para precisão
        system_cpu_percent = psutil.cpu_percent(interval=0.5)
        
        # Memória usada pelo sistema (como no Gerenciador de Tarefas)
        memory_used_gb = (memory_info.total - memory_info.available) / (1024**3)
        memory_total_gb = memory_info.total / (1024**3)
        
        # Total real de processos no sistema
        total_system_processes = len(psutil.pids())
        
        execution_time = round((time.time() - start_time) * 1000, 2)
        
        # Montar resposta final
        result = {
            'success': True,
            'timestamp': int(time.time()),
            'datetime': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'source': 'Python psutil',
            'execution_time_ms': execution_time,
            'processos': processes_data,
            'estatisticas': {
                'total_processos': total_system_processes,  # Total real do sistema
                'total_processos_listados': total_processes_listed,  # Apenas os listados
                'memoria_usada_gb': round(memory_used_gb, 1),
                'memoria_total_gb': round(memory_total_gb, 1),
                'memoria_uso_percent': round(memory_info.percent, 1),
                'cpu_sistema_percent': round(system_cpu_percent, 1),
                'processos_executando': running_count,
                'processos_aguardando': total_processes_listed - running_count
            },
            'sistema': {
                'memoria_total': format_memory(memory_info.total),
                'memoria_disponivel': format_memory(memory_info.available),
                'memoria_usada': format_memory(memory_info.used),
                'uso_memoria_percent': round(memory_info.percent, 1),
                'cpu_count': psutil.cpu_count(),
                'cpu_percent': round(system_cpu_percent, 1),
                'cpu_por_core': psutil.cpu_percent(interval=0.1, percpu=True)
            }        }
        
        return result
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'timestamp': int(time.time()),
            'source': 'Python psutil',
            'processos': [],
            'estatisticas': {
                'total_processos': 0,
                'total_processos_listados': 0,
                'memoria_usada_gb': 0,
                'memoria_total_gb': 0,
                'memoria_uso_percent': 0,
                'cpu_sistema_percent': 0,
                'processos_executando': 0,
                'processos_aguardando': 0
            }
        }

def kill_process(pid):
    """
    Termina um processo pelo PID
    """
    try:
        pid = int(pid)
        
        # Verificar se o processo existe
        if not psutil.pid_exists(pid):
            return {
                'success': False,
                'error': f'Processo com PID {pid} não existe',
                'pid': pid
            }
        
        # Obter informações do processo antes de matar
        try:
            proc = psutil.Process(pid)
            proc_name = proc.name()
            
            # Verificar se é um processo crítico
            critical_processes = ['system', 'csrss', 'winlogon', 'services', 'lsass', 'smss']
            if any(critical in proc_name.lower() for critical in critical_processes):
                return {
                    'success': False,
                    'error': f'Não é possível terminar processo crítico do sistema: {proc_name}',
                    'pid': pid
                }
            
            # Terminar o processo
            proc.terminate()
            
            # Aguardar um pouco para o processo terminar
            try:
                proc.wait(timeout=3)
            except psutil.TimeoutExpired:
                # Se não terminou, forçar
                proc.kill()
                proc.wait(timeout=3)
            
            return {
                'success': True,
                'message': f'Processo {proc_name} (PID: {pid}) terminado com sucesso',
                'pid': pid,
                'nome': proc_name
            }
            
        except psutil.NoSuchProcess:
            return {
                'success': True,
                'message': f'Processo PID {pid} já havia terminado',
                'pid': pid
            }
        except psutil.AccessDenied:
            return {
                'success': False,
                'error': f'Acesso negado para terminar processo PID {pid}. Execute como administrador.',
                'pid': pid
            }
        
    except ValueError:
        return {
            'success': False,
            'error': 'PID deve ser um número inteiro',
            'pid': None
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'Erro inesperado: {str(e)}',
            'pid': pid
        }

def main():
    """
    Função principal - pode ser chamada via linha de comando
    """
    parser = argparse.ArgumentParser(description='Monitor de Processos Python')
    parser.add_argument('--max', type=int, default=50, help='Máximo de processos para retornar')
    parser.add_argument('--kill', type=int, help='PID do processo para terminar')
    parser.add_argument('--expand', type=int, help='Expandir grupo de processos (não agrupar)')
    parser.add_argument('--json', action='store_true', help='Saída em formato JSON')
    
    args = parser.parse_args()
    
    if args.kill:
        result = kill_process(args.kill)
    else:
        result = collect_processes(args.max, args.expand)
    
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        # Saída compacta para integração web
        print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
