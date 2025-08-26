// Main Application Module
import { AgentManager } from './modules/AgentManager.js';
import { WorkflowEngine } from './modules/WorkflowEngine.js';
import { UIController } from './modules/UIController.js';
import { FileHandler } from './modules/FileHandler.js';
import { APIService } from './modules/APIService.js';
import { StorageService } from './modules/StorageService.js';
import { NotificationService } from './modules/NotificationService.js';
import { ThemeManager } from './modules/ThemeManager.js';
import { Templates } from './modules/Templates.js';

class AIAgentOrchestrator {
    constructor() {
        this.initializeServices();
        this.initializeManagers();
        this.attachEventListeners();
        this.loadInitialState();
    }

    initializeServices() {
        this.storage = new StorageService();
        this.notifications = new NotificationService();
        this.api = new APIService();
        this.fileHandler = new FileHandler();
        this.theme = new ThemeManager();
    }

    initializeManagers() {
        this.agentManager = new AgentManager(this.storage, this.notifications);
        this.workflowEngine = new WorkflowEngine(this.api, this.notifications);
        this.ui = new UIController(
            this.agentManager,
            this.workflowEngine,
            this.fileHandler,
            this.notifications
        );
    }

    attachEventListeners() {
        // Agent Form
        document.getElementById('agent-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAgentSubmit();
        });

        // Cancel Edit Button
        document.getElementById('cancel-edit-btn').addEventListener('click', () => {
            this.ui.resetAgentForm();
        });

        // Template Buttons - defer until DOM is ready
        this.attachTemplateListeners();

        // File Upload
        const fileInput = document.getElementById('file-input');
        const dropZone = document.getElementById('file-drop-zone');

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files);
            await this.handleFileUpload(files);
        });

        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            await this.handleFileUpload(files);
        });

        // Import/Export
        document.getElementById('export-agents-btn').addEventListener('click', () => {
            this.exportAgents();
        });
        document.getElementById('import-agents-btn').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });
        document.getElementById('import-file-input').addEventListener('change', (e) => {
            this.importAgents(e.target.files[0]);
        });

        // Workflow Controls
        document.getElementById('start-collaboration').addEventListener('click', () => {
            this.executeWorkflow();
        });
        document.getElementById('clear-sequence').addEventListener('click', () => {
            this.workflowEngine.clearSequence();
            this.ui.updateWorkflowDisplay();
        });

        // Output Controls
        document.getElementById('copy-output-btn').addEventListener('click', () => {
            this.copyOutput();
        });
        document.getElementById('clear-output-btn').addEventListener('click', () => {
            this.ui.clearOutput();
        });
        document.getElementById('download-output-btn').addEventListener('click', () => {
            this.downloadOutput();
        });

        // API Key Visibility Toggle
        document.getElementById('toggle-gemini-visibility').addEventListener('click', (e) => {
            this.togglePasswordVisibility('api-key', e.currentTarget);
        });
        document.getElementById('toggle-tavily-visibility').addEventListener('click', (e) => {
            this.togglePasswordVisibility('tavily-api-key', e.currentTarget);
        });

        // Theme Toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.theme.toggle();
        });

        // Setup Drag and Drop for Workflow
        this.setupWorkflowDragDrop();
    }

    setupWorkflowDragDrop() {
        const availableContainer = document.getElementById('available-agents');
        const selectedContainer = document.getElementById('selected-agents');

        // Make containers droppable
        [availableContainer, selectedContainer].forEach(container => {
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                container.classList.add('drag-over');
            });

            container.addEventListener('dragleave', () => {
                container.classList.remove('drag-over');
            });

            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.classList.remove('drag-over');
                
                const agentId = e.dataTransfer.getData('text/plain');
                const targetContainer = e.currentTarget.id;
                
                if (targetContainer === 'selected-agents') {
                    this.workflowEngine.addToSequence(agentId);
                } else {
                    this.workflowEngine.removeFromSequence(agentId);
                }
                
                this.ui.updateWorkflowDisplay();
            });
        });
    }

    handleAgentSubmit() {
        const formData = this.ui.getAgentFormData();
        
        if (!formData.name || !formData.role) {
            this.notifications.show('Compila tutti i campi obbligatori', 'error');
            return;
        }

        if (formData.editingId) {
            this.agentManager.updateAgent(formData.editingId, formData);
        } else {
            this.agentManager.createAgent(formData);
        }

        this.ui.resetAgentForm();
        this.ui.renderAgentList();
        this.ui.updateWorkflowDisplay();
    }

    async handleFileUpload(files) {
        for (const file of files) {
            try {
                const content = await this.fileHandler.processFile(file);
                this.workflowEngine.addContext({
                    name: file.name,
                    type: file.type,
                    content: content
                });
                this.ui.displayUploadedFile(file.name);
                this.notifications.show(`File "${file.name}" caricato con successo`, 'success');
            } catch (error) {
                this.notifications.show(`Impossibile caricare "${file.name}": ${error.message}`, 'error');
            }
        }
    }

    async executeWorkflow() {
        const apiKey = document.getElementById('api-key').value.trim();
        const tavilyKey = document.getElementById('tavily-api-key').value.trim();
        const userPrompt = document.getElementById('user-request-prompt').value.trim();

        if (!apiKey) {
            this.notifications.show('Fornisci la tua chiave API Gemini', 'error');
            return;
        }

        if (this.workflowEngine.sequence.length === 0) {
            this.notifications.show('Aggiungi almeno un agente al flusso di lavoro', 'error');
            return;
        }

        if (!userPrompt && this.workflowEngine.contextFiles.length === 0) {
            this.notifications.show('Fornisci una descrizione del compito o carica file di contesto', 'error');
            return;
        }

        this.api.setApiKeys(apiKey, tavilyKey);
        this.ui.setExecutionState(true);

        try {
            await this.workflowEngine.execute(
                userPrompt,
                (progress) => this.ui.updateProgress(progress),
                (output) => this.ui.appendOutput(output)
            );
            this.notifications.show('Flusso di lavoro completato con successo', 'success');
        } catch (error) {
            this.notifications.show(`Flusso di lavoro fallito: ${error.message}`, 'error');
        } finally {
            this.ui.setExecutionState(false);
        }
    }

    exportAgents() {
        const agents = this.agentManager.getAllAgents();
        const dataStr = JSON.stringify(agents, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `agents_${new Date().getTime()}.json`;
        link.click();
        
        this.notifications.show('Agenti esportati con successo', 'success');
    }

    async importAgents(file) {
        if (!file) return;

        try {
            const text = await file.text();
            const agents = JSON.parse(text);
            
            if (!Array.isArray(agents)) {
                throw new Error('Formato file non valido');
            }

            agents.forEach(agent => this.agentManager.createAgent(agent));
            this.ui.renderAgentList();
            this.ui.updateWorkflowDisplay();
            
            this.notifications.show(`Importati ${agents.length} agenti con successo`, 'success');
        } catch (error) {
            this.notifications.show('Impossibile importare gli agenti: ' + error.message, 'error');
        }
    }

    copyOutput() {
        const output = document.getElementById('final-output').innerText;
        if (!output || output.includes('Output will appear here')) {
            this.notifications.show('Nessun output da copiare', 'warning');
            return;
        }

        navigator.clipboard.writeText(output).then(() => {
            this.notifications.show('Output copiato negli appunti', 'success');
        }).catch(() => {
            this.notifications.show('Impossibile copiare l\'output', 'error');
        });
    }

    downloadOutput() {
        const output = document.getElementById('final-output').innerText;
        if (!output || output.includes('Output will appear here')) {
            this.notifications.show('Nessun output da scaricare', 'warning');
            return;
        }

        const blob = new Blob([output], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `output_${new Date().getTime()}.txt`;
        link.click();
        
        this.notifications.show('Output scaricato con successo', 'success');
    }

    togglePasswordVisibility(inputId, button) {
        const input = document.getElementById(inputId);
        const icon = button.querySelector('.material-icons-outlined');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.textContent = 'visibility';
        } else {
            input.type = 'password';
            icon.textContent = 'visibility_off';
        }
    }

    attachTemplateListeners() {
        // Wait for DOM to be ready and then attach listeners
        setTimeout(() => {
            document.querySelectorAll('.template-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const templateKey = e.currentTarget.dataset.template;
                    const template = Templates.getTemplate(templateKey);
                    if (template) {
                        this.ui.populateAgentForm(template);
                        this.notifications.show(`Template "${template.name}" caricato`, 'info');
                    }
                });
            });
        }, 100);
    }

    loadInitialState() {
        // Load saved agents
        this.ui.renderAgentList();
        
        // Load saved API keys if any
        const savedGeminiKey = this.storage.get('gemini_api_key');
        const savedTavilyKey = this.storage.get('tavily_api_key');
        
        if (savedGeminiKey) {
            document.getElementById('api-key').value = savedGeminiKey;
        }
        if (savedTavilyKey) {
            document.getElementById('tavily-api-key').value = savedTavilyKey;
        }

        // Attach template listeners after DOM is ready
        this.attachTemplateListeners();

        // Show welcome message
        this.notifications.show('Benvenuto nell\'Orchestratore Agenti AI!', 'info');
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AIAgentOrchestrator();
});