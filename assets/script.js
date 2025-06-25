/**
 * Monitor de Processos FINAL - JavaScript
 * Integração Python + PHP + HTML
 * Author: Sistema de Monitoramento
 * Date: 15 de junho de 2025
 */

class ProcessMonitor {
    constructor() {
        this.apiUrl = 'api/processos.php';
        this.updateInterval = 5000;
        this.autoUpdate = true;
        this.intervalId = null;
        this.currentData = null;
        this.filteredData = [];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupTabs();
        this.showToast('Sistema iniciado', 'Conectando com o backend Python...', 'info');
        this.loadProcesses();
        this.startAutoUpdate();
    }
    
    setupEventListeners() {
        // Controles principais
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadProcesses());
        document.getElementById('autoUpdate').addEventListener('change', (e) => this.toggleAutoUpdate(e.target.checked));
        document.getElementById('updateInterval').addEventListener('change', (e) => this.setUpdateInterval(parseInt(e.target.value)));
        document.getElementById('maxProcesses').addEventListener('change', () => this.loadProcesses());
        
        // Filtros
        document.getElementById('searchFilter').addEventListener('input', () => this.applyFilters());
        document.getElementById('stateFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('categoryFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('sortBy').addEventListener('change', () => this.applyFilters());
        
        // Modal
        this.setupModal();
    }
    
    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;
                
                // Remover active de todos
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Ativar selecionado
                button.classList.add('active');
                document.getElementById(`tab-${tabId}`).classList.add('active');
                
                // Atualizar dados específicos da aba
                if (tabId === 'estatisticas') {
                    this.updateStatistics();
                } else if (tabId === 'sistema') {
                    this.updateSystemInfo();
                }
            });
        });
    }
    
    setupModal() {
        const modal = document.getElementById('killModal');
        const closeBtn = document.getElementById('modalClose');
        const cancelBtn = document.getElementById('modalCancel');
        const confirmBtn = document.getElementById('modalConfirm');
        
        closeBtn.addEventListener('click', () => this.closeModal());
        cancelBtn.addEventListener('click', () => this.closeModal());
        
        confirmBtn.addEventListener('click', () => {
            const pid = document.getElementById('killPid').textContent;
            this.killProcess(parseInt(pid));
        });
        
        // Fechar clicando fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }
    
    async loadProcesses() {
        try {
            this.updateConnectionStatus('loading');
            
            const maxProcesses = document.getElementById('maxProcesses').value;
            const response = await fetch(`${this.apiUrl}?max=${maxProcesses}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Erro desconhecido da API');
            }
            
            this.currentData = data;
            this.updateConnectionStatus('connected');
            this.updateLastUpdate();
            this.applyFilters();
            this.updateSummaryCards();
            this.updateSystemInfo();
            
            // Mostrar toast apenas na primeira conexão ou após erro
            if (!this.hasConnected) {
                this.showToast('Conectado', `${data.processos.length} processos carregados`, 'success');
                this.hasConnected = true;
            }
            
        } catch (error) {
            console.error('Erro ao carregar processos:', error);
            this.updateConnectionStatus('error');
            this.showToast('Erro de Conexão', error.message, 'error');
            this.showErrorInTable(error.message);
        }
    }
    
    applyFilters() {
        if (!this.currentData || !this.currentData.processos) {
            return;
        }
        
        let filtered = [...this.currentData.processos];
        
        // Filtro de busca
        const searchTerm = document.getElementById('searchFilter').value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(p => 
                p.nome.toLowerCase().includes(searchTerm) ||
                p.pid.toString().includes(searchTerm)
            );
        }
        
        // Filtro de estado
        const stateFilter = document.getElementById('stateFilter').value;
        if (stateFilter) {
            filtered = filtered.filter(p => p.estado === stateFilter);
        }
        
        // Filtro de categoria
        const categoryFilter = document.getElementById('categoryFilter').value;
        if (categoryFilter) {
            filtered = filtered.filter(p => p.categoria === categoryFilter);
        }
        
        // Ordenação
        const sortBy = document.getElementById('sortBy').value;
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'memoria':
                    return b.memoria - a.memoria;
                case 'cpu':
                    return b.cpu - a.cpu;
                case 'nome':
                    return a.nome.localeCompare(b.nome);
                case 'pid':
                    return a.pid - b.pid;
                default:
                    return 0;
            }
        });
        
        this.filteredData = filtered;
        this.updateProcessTable();
    }
      updateProcessTable() {
        const tbody = document.getElementById('processTableBody');
        
        if (!this.filteredData || this.filteredData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="loading">
                        <i class="fas fa-search"></i>
                        Nenhum processo encontrado com os filtros aplicados
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.filteredData.map(process => {
            const hasChildren = process.children_count > 0;
            const displayName = process.nome_grupo || process.nome;
            const memoria = process.memoria_total_grupo || process.memoria;
            const cpu = process.cpu_total_grupo || process.cpu;
            const threads = process.threads_total_grupo || process.threads;
            
            return `
                <tr class="${hasChildren ? 'process-group' : ''}" data-pid="${process.pid}">                    <td>
                        ${hasChildren ? 
                            `<button class="expand-btn" onclick="monitor.toggleProcessGroup(${process.pid})" title="Expandir grupo">
                                <i class="fas fa-chevron-right"></i>
                            </button>` : 
                            ''
                        }
                    </td>
                    <td>${process.pid}</td>
                    <td>
                        <strong>${this.escapeHtml(displayName)}</strong>
                        ${hasChildren ? `<small class="text-muted"> (${process.children_count + 1} processos)</small>` : ''}
                    </td>
                    <td><span class="state-badge state-${this.normalizeClass(process.estado)}">${process.estado}</span></td>
                    <td>${memoria} MB</td>
                    <td>${cpu}%</td>
                    <td>${threads}</td>
                    <td><span class="priority-badge priority-${this.normalizeClass(process.prioridade)}">${process.prioridade}</span></td>
                    <td><span class="category-badge category-${this.normalizeClass(process.categoria)}">${process.categoria}</span></td>
                    <td>${this.formatUptime(process.tempo_execucao)}</td>
                    <td>
                        ${process.pode_matar ? 
                            `<button class="btn btn-danger btn-small" onclick="monitor.showKillModal(${process.pid}, '${this.escapeHtml(process.nome)}', ${memoria})">
                                <i class="fas fa-skull"></i>
                                Matar
                            </button>` : 
                            '<span class="text-muted">Protegido</span>'
                        }
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    updateSummaryCards() {
        if (!this.currentData || !this.currentData.estatisticas) {
            return;
        }
          const stats = this.currentData.estatisticas;
        
        document.getElementById('totalProcesses').textContent = stats.total_processos;
        document.getElementById('totalMemory').textContent = `${stats.memoria_usada_gb} GB`;
        document.getElementById('avgCpu').textContent = `${stats.cpu_sistema_percent}%`;
        document.getElementById('runningProcesses').textContent = stats.processos_executando;
    }
    
    updateSystemInfo() {
        if (!this.currentData || !this.currentData.sistema) {
            return;
        }
        
        const system = this.currentData.sistema;
        const apiInfo = this.currentData.api_info;
        
        // Informações do sistema
        document.getElementById('systemMemoryTotal').textContent = `${(system.memoria_total / 1024).toFixed(1)} GB`;
        document.getElementById('systemMemoryAvailable').textContent = `${(system.memoria_disponivel / 1024).toFixed(1)} GB`;
        document.getElementById('systemMemoryUsage').textContent = `${system.uso_memoria_percent.toFixed(1)}%`;
        document.getElementById('systemCpuCount').textContent = system.cpu_count;
        document.getElementById('systemCpuUsage').textContent = `${system.cpu_percent.toFixed(1)}%`;
        
        // Barras de progresso
        document.getElementById('memoryProgressBar').style.width = `${system.uso_memoria_percent}%`;
        document.getElementById('cpuProgressBar').style.width = `${system.cpu_percent}%`;
        
        // Informações da API
        if (apiInfo) {
            document.getElementById('apiSource').textContent = this.currentData.source || 'Python psutil';
            document.getElementById('pythonTime').textContent = `${this.currentData.execution_time_ms || 0} ms`;
            document.getElementById('phpTime').textContent = `${apiInfo.php_execution_time_ms || 0} ms`;
            document.getElementById('totalTime').textContent = `${apiInfo.total_time_ms || 0} ms`;
        }
    }
    
    updateStatistics() {
        if (!this.currentData || !this.currentData.processos) {
            return;
        }
        
        // Placeholder para gráficos futuros
        // Por enquanto, mostrar informação simples
        this.updateStatisticsText();
    }
    
    updateStatisticsText() {
        const processes = this.currentData.processos;
        
        // Distribuição por estado
        const stateChart = document.getElementById('stateChart');
        const states = {};
        processes.forEach(p => {
            states[p.estado] = (states[p.estado] || 0) + 1;
        });
          stateChart.innerHTML = `
            <h4>Distribuição por Estado</h4>
            <div style="flex: 1; overflow-y: auto;">
                ${Object.entries(states).map(([state, count]) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin: 8px 0; padding: 8px; background: #f8fafc; border-radius: 4px;">
                        <span class="state-badge state-${this.normalizeClass(state)}" style="margin-right: 8px;">${state}</span>
                        <strong style="color: var(--primary-color);">${count}</strong>
                    </div>
                `).join('')}
            </div>
        `;
          // Top 10 Memória
        const memoryChart = document.getElementById('memoryChart');
        const topMemory = [...processes]
            .sort((a, b) => b.memoria - a.memoria)
            .slice(0, 10);
        
        memoryChart.innerHTML = `
            <h4>Top 10 - Uso de Memória</h4>
            <div style="flex: 1; overflow-y: auto;">
                ${topMemory.map((p, i) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin: 6px 0; padding: 8px; background: ${i < 3 ? '#fee2e2' : '#f8fafc'}; border-radius: 4px; min-height: 20px;">
                        <span style="flex: 1; margin-right: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            <strong>${i + 1}.</strong> ${this.escapeHtml(p.nome)}
                        </span>
                        <strong style="flex-shrink: 0; color: var(--primary-color);">${p.memoria} MB</strong>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Top 10 CPU
        const cpuChart = document.getElementById('cpuChart');
        const topCpu = [...processes]
            .sort((a, b) => b.cpu - a.cpu)
            .slice(0, 10);
        
        cpuChart.innerHTML = `
            <h4>Top 10 - Uso de CPU</h4>
            <div style="flex: 1; overflow-y: auto;">
                ${topCpu.map((p, i) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin: 6px 0; padding: 8px; background: ${i < 3 ? '#fef3c7' : '#f8fafc'}; border-radius: 4px; min-height: 20px;">
                        <span style="flex: 1; margin-right: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            <strong>${i + 1}.</strong> ${this.escapeHtml(p.nome)}
                        </span>
                        <strong style="flex-shrink: 0; color: var(--warning-color);">${p.cpu}%</strong>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Categorias
        const categoryChart = document.getElementById('categoryChart');
        const categories = {};
        processes.forEach(p => {
            categories[p.categoria] = (categories[p.categoria] || 0) + 1;
        });
          categoryChart.innerHTML = `
            <h4>Distribuição por Categoria</h4>
            <div style="flex: 1; overflow-y: auto;">
                ${Object.entries(categories).map(([category, count]) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin: 8px 0; padding: 8px; background: #f0f9ff; border-radius: 4px;">
                        <span class="category-badge category-${this.normalizeClass(category)}" style="margin-right: 8px;">${category}</span>
                        <strong style="color: var(--info-color);">${count}</strong>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    showKillModal(pid, name, memory) {
        document.getElementById('killPid').textContent = pid;
        document.getElementById('killName').textContent = name;
        document.getElementById('killMemory').textContent = memory;
        document.getElementById('killModal').classList.add('active');
    }
    
    closeModal() {
        document.getElementById('killModal').classList.remove('active');
    }
    
    async killProcess(pid) {
        try {
            this.closeModal();
            this.showToast('Processando...', `Tentando terminar processo PID ${pid}`, 'info');
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'kill',
                    pid: pid
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Sucesso', result.message, 'success');
                // Recarregar processos após 1 segundo
                setTimeout(() => this.loadProcesses(), 1000);
            } else {
                this.showToast('Erro', result.error, 'error');
            }
            
        } catch (error) {
            console.error('Erro ao matar processo:', error);
            this.showToast('Erro', 'Falha na comunicação com o servidor', 'error');
        }
    }
    
    toggleAutoUpdate(enabled) {
        this.autoUpdate = enabled;
        if (enabled) {
            this.startAutoUpdate();
            document.getElementById('stopBtn').style.display = 'none';
            document.getElementById('refreshBtn').style.display = 'flex';
        } else {
            this.stopAutoUpdate();
            document.getElementById('stopBtn').style.display = 'flex';
            document.getElementById('refreshBtn').style.display = 'none';
        }
    }
    
    setUpdateInterval(interval) {
        this.updateInterval = interval;
        if (this.autoUpdate) {
            this.stopAutoUpdate();
            this.startAutoUpdate();
        }
    }
    
    startAutoUpdate() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        if (this.autoUpdate) {
            this.intervalId = setInterval(() => {
                this.loadProcesses();
            }, this.updateInterval);
        }
    }
    
    stopAutoUpdate() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }    updateConnectionStatus(status) {
        // FUNÇÃO DESABILITADA - NÃO FAZ NADA
        // O card agora é sempre fixo e nunca muda
        return;
        
        /* CÓDIGO ANTIGO COMENTADO:
        const statusElement = document.getElementById('connectionStatus');
        const textElement = statusElement.querySelector('.status-text');
        
        statusElement.className = 'status-badge';
        statusElement.classList.add(status);
        
        switch (status) {
            case 'connected':
                textElement.textContent = 'Online';
                break;
            case 'loading':
                textElement.textContent = 'Atualizando';
                break;
            case 'error':
                textElement.textContent = 'Offline';
                break;
            default:
                textElement.textContent = 'Conectando';
                break;
        }
        */
    }
    
    updateLastUpdate() {
        const now = new Date();
        document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();
    }
    
    showErrorInTable(message) {
        const tbody = document.getElementById('processTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="loading" style="color: var(--danger-color);">
                    <i class="fas fa-exclamation-triangle"></i>
                    Erro: ${this.escapeHtml(message)}
                </td>
            </tr>
        `;
    }
    
    showToast(title, message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="${icons[type]}"></i>
            <div>
                <strong>${title}</strong><br>
                <small>${message}</small>
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        // Event listener para fechar toast
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
        
        container.appendChild(toast);
        
        // Auto remove após 5 segundos
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);
    }
    
    // Utility functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    normalizeClass(text) {
        return text.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/ç/g, 'c')
            .replace(/ã/g, 'a')
            .replace(/õ/g, 'o');
    }
    
    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m`;
        } else {
            return `${seconds}s`;
        }
    }      toggleProcessGroup(pid) {
        console.log('Tentando alternar grupo:', pid);
        
        const parentRow = document.querySelector(`tr[data-pid="${pid}"]`);
        const expandBtn = parentRow?.querySelector('.expand-btn');
        const icon = expandBtn?.querySelector('i');
        
        if (!parentRow || !expandBtn || !icon) {
            console.error('Elementos não encontrados para PID:', pid);
            return;
        }
        
        const isExpanded = expandBtn.classList.contains('expanded');
        console.log('Estado atual expandido:', isExpanded);
        
        if (isExpanded) {
            // Colapsar - remover processos filhos
            this.collapseProcessGroup(pid);
            expandBtn.classList.remove('expanded');
            icon.className = 'fas fa-chevron-right';
        } else {
            // Expandir - mostrar processos filhos
            this.expandProcessGroup(pid);
            expandBtn.classList.add('expanded');
            icon.className = 'fas fa-chevron-down';
        }
    }    async expandProcessGroup(parentPid) {
        try {
            console.log('Expandindo grupo para PID:', parentPid);
            
            // Buscar todos os processos do grupo
            const response = await fetch(`api/processos.php?expand=${parentPid}&max=500`);
            if (!response.ok) throw new Error('Erro ao buscar processos do grupo');
            
            const data = await response.json();
            console.log('Dados recebidos:', data);
            
            if (!data.success) throw new Error(data.error || 'Erro desconhecido');
            
            // Verificar se há processos retornados
            if (!data.processos || data.processos.length === 0) {
                this.showToast('Aviso', 'Nenhum processo encontrado no grupo', 'warning');
                return;
            }
            
            // Todos os processos do grupo (incluindo o pai)
            const allGroupProcesses = data.processos;
            console.log('Total de processos no grupo:', allGroupProcesses.length);
            
            // Separar processo pai dos filhos
            const parentProcess = allGroupProcesses.find(p => p.pid === parentPid);
            const childProcesses = allGroupProcesses.filter(p => p.pid !== parentPid);
            
            if (childProcesses.length === 0) {
                this.showToast('Aviso', 'Nenhum processo filho encontrado', 'warning');
                return;
            }
            
            // Encontrar a linha pai na tabela
            const parentRow = document.querySelector(`tr[data-pid="${parentPid}"]`);
            if (!parentRow) {
                console.error('Linha pai não encontrada na tabela');
                return;
            }
              // Inserir processos filhos na tabela
            let insertAfter = parentRow;
            childProcesses.forEach((child, index) => {
                const isLast = index === childProcesses.length - 1;
                const childRowHTML = this.createChildProcessRow(child, isLast, parentPid);
                insertAfter.insertAdjacentHTML('afterend', childRowHTML);
                insertAfter = insertAfter.nextElementSibling;
            });
            
            // Mostrar notificação de sucesso
            this.showToast('Sucesso', `${childProcesses.length} processos filhos expandidos`, 'success');
            
        } catch (error) {
            console.error('Erro ao expandir grupo:', error);
            this.showToast('Erro', `Não foi possível expandir o grupo: ${error.message}`, 'error');
        }
    }
      collapseProcessGroup(parentPid) {
        console.log('Colapsando grupo para PID:', parentPid);
        
        // Encontrar e remover todas as linhas filhas do grupo
        const parentRow = document.querySelector(`tr[data-pid="${parentPid}"]`);
        if (!parentRow) return;
        
        // Remover todas as linhas seguintes que sejam process-child
        let nextRow = parentRow.nextElementSibling;
        let removedCount = 0;
        
        while (nextRow && nextRow.classList.contains('process-child')) {
            const rowToRemove = nextRow;
            nextRow = nextRow.nextElementSibling;
            rowToRemove.remove();
            removedCount++;
        }
        
        console.log(`Removidas ${removedCount} linhas filhas`);
        
        if (removedCount > 0) {
            this.showToast('Sucesso', `Grupo colapsado (${removedCount} processos ocultados)`, 'success');
        }
    }    createChildProcessRow(process, isLast, parentPid = null) {
        const connector = isLast ? '└─' : '├─';
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        };
        
        // Usar parentPid se fornecido, senão usar ppid do processo
        const dataParent = parentPid || process.ppid || 'unknown';
        
        return `
            <tr class="process-child" data-parent="${dataParent}" data-pid="${process.pid}">
                <td></td>
                <td>${process.pid}</td>
                <td>
                    <span class="child-connector">${connector}</span>
                    <strong>${escapeHtml(process.nome || 'Processo')}</strong>
                </td>
                <td><span class="state-badge state-${this.normalizeClass(process.estado || 'unknown')}">${process.estado || 'Desconhecido'}</span></td>
                <td>${(process.memoria || 0).toFixed(1)} MB</td>
                <td>${(process.cpu || 0).toFixed(1)}%</td>
                <td>${process.threads || 0}</td>
                <td><span class="priority-badge priority-${this.normalizeClass(process.prioridade || 'normal')}">${process.prioridade || 'Normal'}</span></td>
                <td><span class="category-badge category-${this.normalizeClass(process.categoria || 'other')}">${process.categoria || 'Outro'}</span></td>
                <td>${this.formatUptime(process.tempo_execucao || 0)}</td>
                <td>
                    ${(process.pode_matar !== false) ? 
                        `<button class="btn btn-danger btn-small" onclick="monitor.showKillModal(${process.pid}, '${escapeHtml(process.nome || 'Processo')}', ${process.memoria || 0})">
                            <i class="fas fa-skull"></i>
                            Matar
                        </button>` : 
                        '<span class="text-muted">Protegido</span>'
                    }
                </td>
            </tr>
        `;
    }
}

// Inicializar quando a página carregar
let monitor;
document.addEventListener('DOMContentLoaded', () => {
    monitor = new ProcessMonitor();
});

// Cleanup quando a página for fechada
window.addEventListener('beforeunload', () => {
    if (monitor) {
        monitor.stopAutoUpdate();
    }
});
