// --- OGGETTO PER LA GESTIONE DELLO STATO ---
const state = {
    agents: [],
    selectedAgentSequence: [],
    fileContext: "",
    editingAgentId: null,

    saveAgents() {
        localStorage.setItem('collaborativeAgents', JSON.stringify(this.agents));
    },
    loadAgents() {
        const saved = localStorage.getItem('collaborativeAgents');
        if (saved) {
            this.agents = JSON.parse(saved);
        }
    },
    addAgent(agent) {
        this.agents.push({ ...agent, id: Date.now() });
        this.saveAgents();
    },
    updateAgent(updatedAgent) {
        const index = this.agents.findIndex(a => a.id === this.editingAgentId);
        if (index !== -1) {
            this.agents[index] = { ...this.agents[index], ...updatedAgent };
            this.saveAgents();
        }
        this.editingAgentId = null;
    },
    deleteAgent(agentId) {
        this.agents = this.agents.filter(a => a.id !== agentId);
        this.selectedAgentSequence = this.selectedAgentSequence.filter(a => a.id !== agentId);
        this.saveAgents();
    },
    getAgentById(id) {
        return this.agents.find(a => a.id === id);
    },
    addAgentToSequence(agentId) {
        const agent = this.getAgentById(agentId);
        if (agent) {
            this.selectedAgentSequence.push(agent);
        }
    },
    removeAgentFromSequence(agentId) {
        this.selectedAgentSequence = this.selectedAgentSequence.filter(a => a.id !== agentId);
    }
};

// --- OGGETTO PER LE CHIAMATE API ---
const api = {
    tools: [{
        "functionDeclarations": [{
            "name": "internet_search",
            "description": "Restituisce i risultati di una ricerca su internet per una data query. Usalo per trovare informazioni aggiornate, notizie, dati o qualsiasi altra cosa che non conosci.",
            "parameters": {
                "type": "OBJECT",
                "properties": { "query": { "type": "STRING", "description": "La stringa di testo da cercare su internet." } },
                "required": ["query"]
            }
        }]
    }],

    async searchTavily(apiKey, query) {
        ui.logToOutput(`<div class="p-2 border-l-4 border-indigo-500 my-2"><p class="text-indigo-300">🔎 Inizio ricerca esterna per: "<em>${query}</em>"...</p></div>`);
        if (!apiKey) {
            const errorMsg = "La chiave API di Tavily non è stata fornita nel campo apposito.";
            ui.displayTechnicalError(errorMsg);
            return errorMsg;
        }
        try {
            const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: apiKey, query: query, search_depth: "basic", include_answer: false, max_results: 5 })
            });
            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(`Errore dalla API di Tavily (Codice: ${response.status}): ${errorBody.error || JSON.stringify(errorBody)}`);
            }
            const data = await response.json();
            const simplifiedResults = data.results.map(r => ({ title: r.title, url: r.url, content: r.content.substring(0, 500) }));
            return JSON.stringify(simplifiedResults);
        } catch (error) {
            const errorMsg = `Errore di rete durante la chiamata a Tavily: ${error.message}`;
            ui.displayTechnicalError(errorMsg);
            return errorMsg;
        }
    },

    async callGemini(apiKey, contents) {
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "contents": contents, "tools": this.tools })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Errore API Gemini (Codice: ${response.status}): ${errorData.error.message}`);
        }
        const responseData = await response.json();
        if (!responseData.candidates || responseData.candidates.length === 0) {
            throw new Error("L'API di Gemini non ha restituito una risposta valida.");
        }
        return responseData.candidates[0];
    }
};

// --- OGGETTO PER LA MANIPOLAZIONE DELL'INTERFACCIA UTENTE ---
const ui = {
    elements: {
        agentForm: document.getElementById('agent-form'),
        agentNameInput: document.getElementById('agent-name'),
        agentRoleInput: document.getElementById('agent-role'),
        outputFormatSelect: document.getElementById('output-format'),
        agentListDiv: document.getElementById('agent-list'),
        formSubmitBtn: document.getElementById('form-submit-btn'),
        fileInput: document.getElementById('file-input'),
        fileNameDisplay: document.getElementById('file-name-display'),
        apiKeyInput: document.getElementById('api-key'),
        tavilyApiKeyInput: document.getElementById('tavily-api-key'),
        availableAgentsDiv: document.getElementById('available-agents'),
        selectedAgentsDiv: document.getElementById('selected-agents'),
        startCollaborationBtn: document.getElementById('start-collaboration'),
        finalOutputDiv: document.getElementById('final-output'),
        fileContextDisplay: document.getElementById('file-context-display'),
        userRequestPrompt: document.getElementById('user-request-prompt'),
        notificationArea: document.getElementById('notification-area'),
    },

    instructionTemplates: {
        markdown: "

IMPORTANTE: Il tuo output DEVE essere una lista formattata in Markdown.",
        json: "

IMPORTANTE: Il tuo output DEVE essere ESCLUSIVAMENTE un oggetto JSON valido, senza testo aggiuntivo prima o dopo."
    },

    showNotification(message, type = 'error') {
        const area = this.elements.notificationArea;
        if (!area) return;

        const colorClass = type === 'error' ? 'bg-red-600' : 'bg-blue-600';
        const notification = document.createElement('div');
        notification.className = `${colorClass} text-white font-bold rounded-md p-3 mb-4 transition-all duration-300 opacity-0`;
        notification.textContent = message;

        area.innerHTML = '';
        area.appendChild(notification);
        
        // Fade in
        setTimeout(() => notification.classList.remove('opacity-0'), 10);

        // Fade out and remove
        setTimeout(() => {
            notification.classList.add('opacity-0');
            setTimeout(() => {
                if (area.contains(notification)) {
                    area.removeChild(notification);
                }
            }, 300);
        }, 5000);
    },

    createAgentElement(agent, handlers) {
        const el = document.createElement('div');
        el.className = 'bg-gray-700 p-4 rounded-md flex justify-between items-start gap-2';
        
        const formatBadge = { 
            markdown: '<span class="bg-sky-500 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">Markdown</span>', 
            json: '<span class="bg-purple-500 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">JSON</span>', 
            text: '' 
        }[agent.format];

        el.innerHTML = `
            <div class="flex-grow">
                <h4 class="font-bold text-cyan-400">${formatBadge}${agent.name}</h4>
                <p class="text-sm text-gray-300 mt-1 whitespace-pre-wrap">${agent.finalRole}</p>
            </div>
            <div class="flex flex-col gap-2 flex-shrink-0">
                <button class="edit-btn bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded-md transition-colors">Modifica</button>
                <button class="delete-btn bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-md transition-colors">Elimina</button>
            </div>`;
        
        el.querySelector('.edit-btn').addEventListener('click', () => handlers.onEdit(agent.id));
        el.querySelector('.delete-btn').addEventListener('click', () => handlers.onDelete(agent.id));
        
        return el;
    },

    renderAgents(handlers) {
        this.elements.agentListDiv.innerHTML = '';
        if (state.agents.length === 0) {
            this.elements.agentListDiv.innerHTML = '<p class="text-gray-500">Nessun agente ancora creato.</p>';
            return;
        }
        state.agents.forEach(agent => {
            const agentElement = this.createAgentElement(agent, handlers);
            this.elements.agentListDiv.appendChild(agentElement);
        });
    },

    createCollaborationAgentElement(agent, type, onClick) {
        const el = document.createElement('div');
        el.textContent = agent.name;
        el.dataset.id = agent.id;
        if (type === 'available') {
            el.className = 'agent-box bg-gray-700 p-2 rounded-md hover:bg-gray-600 cursor-pointer';
        } else {
            el.className = 'agent-box bg-cyan-800 p-2 rounded-md hover:bg-cyan-700 cursor-pointer';
            el.textContent = `${state.selectedAgentSequence.indexOf(agent) + 1}. ${agent.name}`;
        }
        el.addEventListener('click', () => onClick(agent.id));
        return el;
    },

    renderCollaborationOptions(handlers) {
        this.elements.availableAgentsDiv.innerHTML = '';
        this.elements.selectedAgentsDiv.innerHTML = '';

        const available = state.agents.filter(agent => !state.selectedAgentSequence.find(sa => sa.id === agent.id));
        
        if (available.length === 0) {
            this.elements.availableAgentsDiv.innerHTML = '<p class="text-gray-500 text-sm">Nessun altro agente disponibile.</p>';
        } else {
            available.forEach(agent => {
                const el = this.createCollaborationAgentElement(agent, 'available', handlers.onSelect);
                this.elements.availableAgentsDiv.appendChild(el);
            });
        }

        if (state.selectedAgentSequence.length === 0) {
            this.elements.selectedAgentsDiv.innerHTML = '<p class="text-gray-500 text-sm">Clicca un agente a sinistra per aggiungerlo qui.</p>';
        } else {
            state.selectedAgentSequence.forEach(agent => {
                const el = this.createCollaborationAgentElement(agent, 'selected', handlers.onDeselect);
                this.elements.selectedAgentsDiv.appendChild(el);
            });
        }
    },
    
    updateFormForEditing(agent) {
        this.elements.agentNameInput.value = agent.name;
        this.elements.agentRoleInput.value = agent.baseRole;
        this.elements.outputFormatSelect.value = agent.format;
        this.elements.formSubmitBtn.textContent = 'Salva Modifiche';
        this.elements.formSubmitBtn.className = 'bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-md transition-colors';
        window.scrollTo(0, 0);
    },

    resetForm() {
        this.elements.agentForm.reset();
        state.editingAgentId = null;
        this.elements.formSubmitBtn.textContent = 'Aggiungi Agente';
        this.elements.formSubmitBtn.className = 'bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-md transition-colors';
    },

    setCollaborationStatus(inProgress) {
        this.elements.startCollaborationBtn.disabled = inProgress;
        this.elements.startCollaborationBtn.textContent = inProgress ? 'Collaborazione in corso...' : 'Avvia Collaborazione';
    },

    logToOutput(html) {
        this.elements.finalOutputDiv.innerHTML += html;
    },
    
    clearOutput() {
        this.elements.finalOutputDiv.innerHTML = '';
    },

    displayTechnicalError(message) {
        this.logToOutput(`<div class="p-4 my-2 bg-red-800 border border-red-500 rounded-lg"><p class="font-bold text-white">ERRORE TECNICO RILEVATO:</p><p class="whitespace-pre-wrap text-red-200 font-mono mt-2">${message}</p></div>`);
    }
};

// --- LOGICA PRINCIPALE DELL'APPLICAZIONE ---
const app = {
    init() {
        // Carica dati e imposta i listener
        state.loadAgents();
        this.renderAll();
        
        ui.elements.agentForm.addEventListener('submit', this.handleFormSubmit.bind(this));
        ui.elements.fileInput.addEventListener('change', this.handleFileChange.bind(this));
        ui.elements.startCollaborationBtn.addEventListener('click', this.startCollaboration.bind(this));
    },

    renderAll() {
        const agentHandlers = {
            onEdit: this.handleEditAgent.bind(this),
            onDelete: this.handleDeleteAgent.bind(this)
        };
        const collaborationHandlers = {
            onSelect: this.handleSelectAgent.bind(this),
            onDeselect: this.handleDeselectAgent.bind(this)
        };
        ui.renderAgents(agentHandlers);
        ui.renderCollaborationOptions(collaborationHandlers);
    },

    handleFormSubmit(event) {
        event.preventDefault();
        const name = ui.elements.agentNameInput.value.trim();
        const baseRole = ui.elements.agentRoleInput.value.trim();
        const format = ui.elements.outputFormatSelect.value;

        if (!name || !baseRole) return;

        let finalRole = baseRole;
        if (format === 'markdown') finalRole += ui.instructionTemplates.markdown;
        else if (format === 'json') finalRole += ui.instructionTemplates.json;

        const agentData = { name, baseRole, format, finalRole };

        if (state.editingAgentId) {
            state.updateAgent(agentData);
        } else {
            state.addAgent(agentData);
        }
        
        ui.resetForm();
        this.renderAll();
    },

    handleEditAgent(agentId) {
        const agent = state.getAgentById(agentId);
        if (agent) {
            state.editingAgentId = agentId;
            ui.updateFormForEditing(agent);
        }
    },

    handleDeleteAgent(agentId) {
        if (confirm('Sei sicuro di voler eliminare questo agente?')) {
            state.deleteAgent(agentId);
            this.renderAll();
        }
    },

    handleSelectAgent(agentId) {
        state.addAgentToSequence(agentId);
        this.renderAll();
    },

    handleDeselectAgent(agentId) {
        state.removeAgentFromSequence(agentId);
        this.renderAll();
    },

    handleFileChange(event) {
        const file = event.target.files[0];
        if (!file) return;

        ui.elements.fileNameDisplay.textContent = `Caricamento: ${file.name}...`;
        ui.elements.fileContextDisplay.textContent = `Sto processando il file...`;
        
        const reader = new FileReader();
        const processResult = (content) => {
            state.fileContext = content;
            ui.elements.fileContextDisplay.textContent = content;
            ui.elements.fileNameDisplay.textContent = `Caricato: ${file.name}`;
        };
        const processError = (err) => {
            state.fileContext = "";
            ui.elements.fileContextDisplay.textContent = `Errore nella lettura del file: ${err}`;
            ui.elements.fileNameDisplay.textContent = `Errore: ${file.name}`;
        };

        if (file.name.endsWith('.docx')) {
            reader.onload = (e) => mammoth.extractRawText({ arrayBuffer: e.target.result })
                .then(r => processResult(r.value))
                .catch(e => processError(e.message));
            reader.readAsArrayBuffer(file);
        } else if (file.name.endsWith('.xlsx')) {
            reader.onload = (e) => {
                try {
                    const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                    let content = '';
                    workbook.SheetNames.forEach(name => {
                        content += `--- Foglio: ${name} ---
${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}

`;
                    });
                    processResult(content);
                } catch (e) {
                    processError(e.message);
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            reader.onload = (e) => processResult(e.target.result);
            reader.readAsText(file);
        }
    },

    async startCollaboration() {
        const geminiKey = ui.elements.apiKeyInput.value.trim();
        const userRequest = ui.elements.userRequestPrompt.value.trim();

        if (!geminiKey || state.selectedAgentSequence.length === 0 || (!userRequest && !state.fileContext)) {
            ui.showNotification('Per favore, compila la chiave API Gemini, la richiesta e seleziona almeno un agente.');
            return;
        }

        ui.setCollaborationStatus(true);
        ui.clearOutput();

        let overallConversationHistory = [];
        let initialUserProvidedText = userRequest;
        if (state.fileContext) {
            initialUserProvidedText += `

--- CONTESTO DAL FILE ---
${state.fileContext}
--- FINE CONTESTO DAL FILE ---`;
        }
        
        let previousAgentOutput = initialUserProvidedText;

        for (let i = 0; i < state.selectedAgentSequence.length; i++) {
            const agent = state.selectedAgentSequence[i];
            ui.logToOutput(`<div class="p-2 border-b border-gray-700 mt-4"><p class="font-bold text-cyan-400">➡️ Esecuzione Agente ${i + 1}: ${agent.name}...</p></div>`);
            
            let promptTextForThisAgentTurn;
            if (i === 0) {
                promptTextForThisAgentTurn = `Il tuo ruolo è: ${agent.finalRole}.

La richiesta iniziale dell'utente (che può includere un articolo o un testo da analizzare) è la seguente:
"${previousAgentOutput}"

Basandoti su questa richiesta ed eventualmente usando lo strumento 'internet_search' per informazioni aggiuntive o verifiche, esegui il tuo compito.`;
                if (overallConversationHistory.length === 0) {
                     overallConversationHistory.push({ role: "user", parts: [{ text: initialUserProvidedText }] });
                }
            } else {
                promptTextForThisAgentTurn = `Il tuo ruolo è: ${agent.finalRole}.

L'input per te è il seguente testo prodotto dall'agente precedente:
"${previousAgentOutput}"

Basandoti specificamente su QUESTO TESTO, ed eventualmente usando lo strumento 'internet_search' per informazioni aggiuntive o per arricchirlo, esegui il tuo compito. Se necessario per il contesto generale, puoi fare riferimento alla cronologia completa della conversazione fornita prima di questo messaggio.`;
            }
            
            let contentsForThisAgentTurn = [...overallConversationHistory, { role: "user", parts: [{ text: promptTextForThisAgentTurn }] }];
            
            let agentFinishedTurn = false;
            let finalAgentTextResponse = null;

            try {
                for (let toolTurn = 0; toolTurn < 5 && !agentFinishedTurn; toolTurn++) { 
                    const candidate = await api.callGemini(geminiKey, contentsForThisAgentTurn);
                    const modelResponseParts = candidate.content.parts;

                    if (candidate.finishReason === "TOOL_TOO_LONG" || (candidate.content && modelResponseParts.length === 0 && (!modelResponseParts[0] || !modelResponseParts[0].functionCall))) {
                        const toolErrorMessage = "L'agente ha tentato di usare uno strumento, ma il risultato era troppo lungo o vuoto. L'agente non può procedere.";
                        ui.displayTechnicalError(toolErrorMessage);
                        finalAgentTextResponse = toolErrorMessage;
                        agentFinishedTurn = true;
                        break;
                    }
                    
                    if (modelResponseParts[0].functionCall) {
                        ui.logToOutput(`<p class="text-sm text-gray-400 italic ml-4">L'agente ${agent.name} ha deciso di usare uno strumento...</p>`);
                        contentsForThisAgentTurn.push(candidate.content);
                        
                        const toolResponsePartsCollector = [];
                        for (const part of modelResponseParts) {
                            if (part.functionCall && part.functionCall.name === 'internet_search') {
                                const toolResult = await api.searchTavily(ui.elements.tavilyApiKeyInput.value.trim(), part.functionCall.args.query);
                                toolResponsePartsCollector.push({ functionResponse: { name: "internet_search", response: { content: toolResult } } });
                            } else {
                                toolResponsePartsCollector.push({ functionResponse: { name: part.functionCall.name, response: { content: "ERRORE: Strumento sconosciuto." } } });
                            }
                        }
                        contentsForThisAgentTurn.push({ role: "tool", parts: toolResponsePartsCollector });
                    } else {
                        finalAgentTextResponse = modelResponseParts[0].text;
                        agentFinishedTurn = true; 
                    }
                }

                if (finalAgentTextResponse === null && !agentFinishedTurn) { 
                     finalAgentTextResponse = `L'agente ${agent.name} non ha prodotto una risposta testuale finale dopo 5 tentativi con gli strumenti.`;
                     ui.displayTechnicalError(finalAgentTextResponse);
                }

            } catch (error) {
                ui.displayTechnicalError(`Errore durante l'esecuzione di ${agent.name}: ${error.message}`);
                ui.setCollaborationStatus(false);
                return;
            }

            ui.logToOutput(`<div class="p-4 bg-gray-800 rounded-b-lg mb-4"><p class="whitespace-pre-wrap">${finalAgentTextResponse || ''}</p></div>`);
            
            overallConversationHistory.push({ role: "user", parts: [{ text: promptTextForThisAgentTurn }] });
            overallConversationHistory.push({ role: "model", parts: [{ text: finalAgentTextResponse || "Nessun output testuale prodotto dall'agente." }] });
        
            previousAgentOutput = finalAgentTextResponse; 
        } 
        
        ui.logToOutput(`<div class="p-2 border-t-2 border-green-500 mt-4"><p class="font-bold text-green-400">✅ Collaborazione completata!</p></div>`);
        ui.setCollaborationStatus(false);
    }
};

// --- INIZIALIZZAZIONE ---
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
