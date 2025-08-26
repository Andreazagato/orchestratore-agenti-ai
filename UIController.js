export class UIController {
    constructor(agentManager, workflowEngine, fileHandler, notifications) {
        this.agentManager = agentManager;
        this.workflowEngine = workflowEngine;
        this.fileHandler = fileHandler;
        this.notifications = notifications;
        this.editingAgentId = null;
    }

    renderAgentList() {
        const container = document.getElementById('agent-list');
        const agents = this.agentManager.getAllAgents();
        
        if (agents.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-outlined text-gray-500">smart_toy</span>
                    <p class="text-sm text-gray-500 mt-2">Nessun agente creato</p>
                </div>
            `;
            return;
        }

        container.innerHTML = agents.map(agent => this.createAgentCard(agent)).join('');
        
        // Attach event listeners
        container.querySelectorAll('.agent-card').forEach(card => {
            const agentId = card.dataset.agentId;
            
            card.querySelector('.edit-agent').addEventListener('click', () => {
                this.editAgent(agentId);
            });
            
            card.querySelector('.delete-agent').addEventListener('click', () => {
                this.deleteAgent(agentId);
            });

            // Make draggable
            card.draggable = true;
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', agentId);
                card.classList.add('dragging');
            });
            
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
            });
        });

        this.updateWorkflowDisplay();
    }

    createAgentCard(agent) {
        const formatColors = {
            markdown: 'markdown',
            json: 'json',
            html: 'html',
            csv: 'csv',
            text: 'text'
        };

        return `
            <div class="agent-card" data-agent-id="${agent.id}">
                <div class="agent-name">
                    <span class="format-badge ${formatColors[agent.format]}">${agent.format.toUpperCase()}</span>
                    <span>${agent.name}</span>
                </div>
                <div class="agent-role">${agent.role}</div>
                <div class="flex gap-2 mt-2">
                    <button class="icon-btn edit-agent">
                        <span class="material-icons-outlined text-sm">edit</span>
                    </button>
                    <button class="icon-btn delete-agent">
                        <span class="material-icons-outlined text-sm">delete</span>
                    </button>
                </div>
            </div>
        `;
    }

    updateWorkflowDisplay() {
        const availableContainer = document.getElementById('available-agents');
        const selectedContainer = document.getElementById('selected-agents');
        
        const allAgents = this.agentManager.getAllAgents();
        const selectedIds = this.workflowEngine.sequence;
        
        // Available agents (not in sequence)
        const availableAgents = allAgents.filter(a => !selectedIds.includes(a.id));
        
        if (availableAgents.length === 0) {
            availableContainer.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-outlined text-gray-500">inbox</span>
                    <p class="text-sm text-gray-500 mt-2">Tutti gli agenti in uso</p>
                </div>
            `;
        } else {
            availableContainer.innerHTML = availableAgents.map(agent => 
                this.createWorkflowCard(agent, false)
            ).join('');
        }
        
        // Selected agents (in sequence)
        if (selectedIds.length === 0) {
            selectedContainer.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-outlined text-gray-500">drag_indicator</span>
                    <p class="text-sm text-gray-500 mt-2">Trascina gli agenti qui per costruire il flusso</p>
                </div>
            `;
        } else {
            selectedContainer.innerHTML = selectedIds.map((id, index) => {
                const agent = this.agentManager.getAgent(id);
                return agent ? this.createWorkflowCard(agent, true, index + 1) : '';
            }).join('');
        }

        // Make cards draggable
        [...availableContainer.querySelectorAll('.agent-card'), 
         ...selectedContainer.querySelectorAll('.agent-card')].forEach(card => {
            const agentId = card.dataset.agentId;
            
            card.draggable = true;
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', agentId);
                card.classList.add('dragging');
            });
            
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
            });
        });
    }

    createWorkflowCard(agent, isSelected, order = null) {
        return `
            <div class="agent-card" data-agent-id="${agent.id}">
                <div class="agent-name">
                    ${order ? `<span class="text-cyan-400 font-bold mr-2">${order}.</span>` : ''}
                    <span>${agent.name}</span>
                </div>
                <div class="text-xs text-gray-400">${agent.format.toUpperCase()}</div>
            </div>
        `;
    }

    editAgent(agentId) {
        const agent = this.agentManager.getAgent(agentId);
        if (!agent) return;

        this.editingAgentId = agentId;
        document.getElementById('editing-agent-id').value = agentId;
        document.getElementById('agent-name').value = agent.name;
        document.getElementById('agent-role').value = agent.role;
        document.getElementById('output-format').value = agent.format;
        
        document.getElementById('form-submit-btn').innerHTML = `
            <span class="material-icons-outlined mr-2">save</span>
            Aggiorna Agente
        `;
        
        document.getElementById('cancel-edit-btn').classList.remove('hidden');
        
        // Scroll to form
        document.getElementById('agent-form').scrollIntoView({ behavior: 'smooth' });
    }

    deleteAgent(agentId) {
        const agent = this.agentManager.getAgent(agentId);
        if (!agent) return;

        if (confirm(`Eliminare l'agente "${agent.name}"? Questa azione non può essere annullata.`)) {
            this.agentManager.deleteAgent(agentId);
            this.workflowEngine.removeFromSequence(agentId);
            this.renderAgentList();
        }
    }

    resetAgentForm() {
        this.editingAgentId = null;
        document.getElementById('agent-form').reset();
        document.getElementById('editing-agent-id').value = '';
        
        document.getElementById('form-submit-btn').innerHTML = `
            <span class="material-icons-outlined mr-2">add_circle</span>
            Crea Agente
        `;
        
        document.getElementById('cancel-edit-btn').classList.add('hidden');
    }

    getAgentFormData() {
        return {
            editingId: document.getElementById('editing-agent-id').value || null,
            name: document.getElementById('agent-name').value.trim(),
            role: document.getElementById('agent-role').value.trim(),
            format: document.getElementById('output-format').value
        };
    }

    populateAgentForm(template) {
        document.getElementById('agent-name').value = template.name;
        document.getElementById('agent-role').value = template.role;
        document.getElementById('output-format').value = template.format;
    }

    displayUploadedFile(fileName) {
        const container = document.getElementById('uploaded-files');
        const fileEl = document.createElement('div');
        fileEl.className = 'flex items-center justify-between p-2 bg-slate-800/50 rounded-lg';
        fileEl.innerHTML = `
            <span class="text-sm text-gray-300 flex items-center gap-2">
                <span class="material-icons-outlined text-xs">description</span>
                ${fileName}
            </span>
            <button class="icon-btn remove-file">
                <span class="material-icons-outlined text-sm">close</span>
            </button>
        `;
        
        fileEl.querySelector('.remove-file').addEventListener('click', () => {
            fileEl.remove();
            // Remove from context
            this.workflowEngine.contextFiles = this.workflowEngine.contextFiles.filter(
                f => f.name !== fileName
            );
        });
        
        container.appendChild(fileEl);
    }

    setExecutionState(isExecuting) {
        const button = document.getElementById('start-collaboration');
        const progressIndicator = document.getElementById('progress-indicator');
        
        if (isExecuting) {
            button.disabled = true;
            button.innerHTML = `
                <div class="spinner mr-2"></div>
                In esecuzione...
            `;
            progressIndicator.classList.remove('hidden');
        } else {
            button.disabled = false;
            button.innerHTML = `
                <span class="material-icons-outlined mr-2">play_arrow</span>
                Esegui Flusso di Lavoro
            `;
            progressIndicator.classList.add('hidden');
        }
    }

    updateProgress(progress) {
        const progressText = document.getElementById('progress-text');
        const progressFill = document.getElementById('progress-fill');
        
        if (progress.status === 'executing') {
            progressText.textContent = `Esecuzione di ${progress.agent} (${progress.current}/${progress.total})`;
            progressFill.style.width = `${(progress.current / progress.total) * 100}%`;
        } else if (progress.status === 'completed') {
            progressText.textContent = 'Flusso di lavoro completato!';
            progressFill.style.width = '100%';
        }
    }

    appendOutput(output) {
        const container = document.getElementById('final-output');
        
        // Clear empty state if present
        if (container.querySelector('.empty-state')) {
            container.innerHTML = '';
        }
        
        const section = document.createElement('div');
        section.className = 'output-section';
        
        const typeClasses = {
            system: 'system-message',
            agent: 'agent-output',
            error: 'error-message',
            success: 'success-message'
        };
        
        section.classList.add(typeClasses[output.type] || 'system-message');
        
        if (output.agent) {
            section.innerHTML = `
                <div class="text-xs text-gray-400 mb-2">
                    <span class="material-icons-outlined text-xs align-middle">smart_toy</span>
                    ${output.agent}
                </div>
                <div class="whitespace-pre-wrap">${this.escapeHtml(output.content)}</div>
            `;
        } else {
            section.innerHTML = `<div class="whitespace-pre-wrap">${this.escapeHtml(output.content)}</div>`;
        }
        
        container.appendChild(section);
        container.scrollTop = container.scrollHeight;
    }

    clearOutput() {
        const container = document.getElementById('final-output');
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-icons-outlined text-gray-500">pending</span>
                <p class="text-sm text-gray-500 mt-2">L'output apparirà qui</p>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}