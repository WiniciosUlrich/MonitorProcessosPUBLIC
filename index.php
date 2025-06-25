<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monitor de Processos FINAL - Python Integration</title>
    <link rel="stylesheet" href="assets/style.css">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
</head>

<body>
    <div class="container">
        <!-- Header -->
        <header class="header">
            <div class="header-content">
                <h1><i class="fas fa-microchip"></i> Monitor de Processos FINAL</h1>                <div class="header-info">
                    <div class="status-badge" id="connectionStatus">
                        <div class="status-indicator"></div>
                        <div class="status-text"></div>
                    </div>
                    <div class="last-update">
                        Última atualização: <span id="lastUpdate">--:--:--</span>
                    </div>
                </div>
            </div>
        </header>

        <!-- Navigation Tabs -->
        <nav class="tabs">
            <button class="tab-button active" data-tab="processos">
                <i class="fas fa-list"></i>
                Processos
            </button>
            <button class="tab-button" data-tab="estatisticas">
                <i class="fas fa-chart-bar"></i>
                Estatísticas
            </button>
            <button class="tab-button" data-tab="sistema">
                <i class="fas fa-server"></i>
                Sistema
            </button>
        </nav>

        <!-- Control Panel -->
        <div class="control-panel">
            <div class="controls-left">
                <div class="control-group">
                    <label for="autoUpdate">
                        <input type="checkbox" id="autoUpdate" checked>
                        Atualização automática
                    </label>
                    <select id="updateInterval">
                        <option value="2000">2 segundos</option>
                        <option value="5000" selected>5 segundos</option>
                        <option value="10000">10 segundos</option>
                    </select>
                </div>
                <div class="control-group">
                    <label for="maxProcesses">Máx. processos:</label>
                    <select id="maxProcesses">
                        <option value="25">25</option>
                        <option value="50" selected>50</option>
                        <option value="100">100</option>
                        <option value="200">200</option>
                    </select>
                </div>
            </div>
            <div class="controls-right">
                <button class="btn btn-primary" id="refreshBtn">
                    <i class="fas fa-sync-alt"></i>
                    Atualizar
                </button>
                <button class="btn btn-secondary" id="stopBtn" style="display: none;">
                    <i class="fas fa-stop"></i>
                    Parar
                </button>
            </div>
        </div>

        <!-- Filters -->
        <div class="filters">
            <div class="filter-group">
                <input type="text" id="searchFilter" placeholder="Buscar por nome do processo..." class="search-input">
            </div>
            <div class="filter-group"> <select id="stateFilter">
                    <option value="">Todos os estados</option>
                    <option value="Executando">Executando</option>
                    <option value="Pronto">Pronto</option>
                    <option value="Esperando">Esperando</option>
                    <option value="Finalizado">Finalizado</option>
                </select>
            </div>
            <div class="filter-group">
                <select id="categoryFilter">
                    <option value="">Todas as categorias</option>
                    <option value="Sistema">Sistema</option>
                    <option value="Aplicacao">Aplicação</option>
                    <option value="Navegador">Navegador</option>
                    <option value="Desenvolvimento">Desenvolvimento</option>
                </select>
            </div>
            <div class="filter-group">
                <select id="sortBy">
                    <option value="memoria">Memória (Desc)</option>
                    <option value="cpu">CPU (Desc)</option>
                    <option value="nome">Nome (A-Z)</option>
                    <option value="pid">PID (Asc)</option>
                </select>
            </div>
        </div>

        <!-- Main Content -->
        <main class="main-content">
            <!-- Tab: Processos -->
            <div class="tab-content active" id="tab-processos">
                <div class="summary-cards">
                    <div class="card">
                        <div class="card-icon">
                            <i class="fas fa-microchip"></i>
                        </div>
                        <div class="card-content">
                            <h3 id="totalProcesses">0</h3>
                            <p>Total de Processos</p>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-icon">
                            <i class="fas fa-memory"></i>
                        </div>
                        <div class="card-content">
                            <h3 id="totalMemory">0 GB</h3>
                            <p>Uso Memória do Sistema</p>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-icon">
                            <i class="fas fa-tachometer-alt"></i>
                        </div>
                        <div class="card-content">
                            <h3 id="avgCpu">0%</h3>
                            <p>CPU do Sistema</p>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-icon">
                            <i class="fas fa-play"></i>
                        </div>
                        <div class="card-content">
                            <h3 id="runningProcesses">0</h3>
                            <p>Executando</p>
                        </div>
                    </div>
                </div>

                <!-- Process Table -->
                <div class="table-container">
                    <table class="process-table">
                        <thead>
                            <tr>
                                <th></th> <!-- Coluna para expandir/colapsar -->
                                <th>PID</th>
                                <th>Nome</th>
                                <th>Estado</th>
                                <th>Memória (MB)</th>
                                <th>CPU (%)</th>
                                <th>Threads</th>
                                <th>Prioridade</th>
                                <th>Categoria</th>
                                <th>Tempo</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody id="processTableBody">
                            <tr>
                                <td colspan="11" class="loading">
                                    <i class="fas fa-spinner fa-spin"></i>
                                    Carregando processos...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Estatísticas -->
            <div class="tab-content" id="tab-estatisticas">
                <div class="stats-grid">
                    <div class="stat-card">
                        <h3>Distribuição por Estado</h3>
                        <div id="stateChart" class="chart-placeholder">
                            <i class="fas fa-chart-pie"></i>
                            <p>Carregando gráfico...</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <h3>Top 10 - Memória</h3>
                        <div id="memoryChart" class="chart-placeholder">
                            <i class="fas fa-chart-bar"></i>
                            <p>Carregando gráfico...</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <h3>Top 10 - CPU</h3>
                        <div id="cpuChart" class="chart-placeholder">
                            <i class="fas fa-chart-line"></i>
                            <p>Carregando gráfico...</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <h3>Categorias</h3>
                        <div id="categoryChart" class="chart-placeholder">
                            <i class="fas fa-chart-donut"></i>
                            <p>Carregando gráfico...</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab: Sistema -->
            <div class="tab-content" id="tab-sistema">
                <div class="system-info">
                    <div class="system-card">
                        <h3><i class="fas fa-memory"></i> Memória do Sistema</h3>
                        <div class="system-details">
                            <div class="detail-row">
                                <span>Total:</span>
                                <span id="systemMemoryTotal">-- GB</span>
                            </div>
                            <div class="detail-row">
                                <span>Disponível:</span>
                                <span id="systemMemoryAvailable">-- GB</span>
                            </div>
                            <div class="detail-row">
                                <span>Uso:</span>
                                <span id="systemMemoryUsage">--%</span>
                            </div>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="memoryProgressBar"></div>
                        </div>
                    </div>

                    <div class="system-card">
                        <h3><i class="fas fa-microchip"></i> Processador</h3>
                        <div class="system-details">
                            <div class="detail-row">
                                <span>Núcleos:</span>
                                <span id="systemCpuCount">--</span>
                            </div>
                            <div class="detail-row">
                                <span>Uso Atual:</span>
                                <span id="systemCpuUsage">--%</span>
                            </div>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="cpuProgressBar"></div>
                        </div>
                    </div>

                    <div class="system-card">
                        <h3><i class="fas fa-info-circle"></i> Informações da API</h3>
                        <div class="system-details">
                            <div class="detail-row">
                                <span>Fonte:</span>
                                <span id="apiSource">--</span>
                            </div>
                            <div class="detail-row">
                                <span>Tempo Python:</span>
                                <span id="pythonTime">-- ms</span>
                            </div>
                            <div class="detail-row">
                                <span>Tempo PHP:</span>
                                <span id="phpTime">-- ms</span>
                            </div>
                            <div class="detail-row">
                                <span>Tempo Total:</span>
                                <span id="totalTime">-- ms</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- Modal Kill Process -->
    <div class="modal" id="killModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-exclamation-triangle"></i> Confirmar Terminação</h3>
                <button class="modal-close" id="modalClose">&times;</button>
            </div>
            <div class="modal-body">
                <p>Tem certeza que deseja terminar o processo?</p>
                <div class="process-info">
                    <strong>PID:</strong> <span id="killPid">--</span><br>
                    <strong>Nome:</strong> <span id="killName">--</span><br>
                    <strong>Memória:</strong> <span id="killMemory">--</span> MB
                </div>
                <div class="warning">
                    <i class="fas fa-warning"></i>
                    <strong>Atenção:</strong> Terminar processos do sistema pode causar instabilidade.
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="modalCancel">Cancelar</button>
                <button class="btn btn-danger" id="modalConfirm">
                    <i class="fas fa-skull"></i>
                    Terminar Processo
                </button>
            </div>
        </div>
    </div>

    <!-- Toast Notifications -->
    <div class="toast-container" id="toastContainer"></div>

    <!-- Scripts -->
    <script src="assets/script.js"></script>
</body>

</html>