export class AgentManager {
    constructor(storage, notifications) {
        this.storage = storage;
        this.notifications = notifications;
        this.agents = this.loadAgents();
    }

    loadAgents() {
        return this.storage.get('agents') || [];
    }

    saveAgents() {
        this.storage.set('agents', this.agents);
    }

    createAgent(agentData) {
        const agent = {
            id: Date.now().toString(),
            name: agentData.name,
            role: agentData.role,
            format: agentData.format || 'text',
            created: new Date().toISOString(),
            modified: new Date().toISOString()
        };

        // Add format-specific instructions
        agent.instructions = this.buildInstructions(agent.role, agent.format);
        
        this.agents.push(agent);
        this.saveAgents();
        this.notifications.show(`Agente "${agent.name}" creato con successo`, 'success');
        
        return agent;
    }

    updateAgent(id, updates) {
        const index = this.agents.findIndex(a => a.id === id);
        if (index === -1) {
            this.notifications.show('Agente non trovato', 'error');
            return null;
        }

        this.agents[index] = {
            ...this.agents[index],
            ...updates,
            instructions: this.buildInstructions(updates.role, updates.format),
            modified: new Date().toISOString()
        };

        this.saveAgents();
        this.notifications.show(`Agente "${this.agents[index].name}" aggiornato con successo`, 'success');
        
        return this.agents[index];
    }

    deleteAgent(id) {
        const agent = this.agents.find(a => a.id === id);
        if (!agent) {
            this.notifications.show('Agente non trovato', 'error');
            return false;
        }

        this.agents = this.agents.filter(a => a.id !== id);
        this.saveAgents();
        this.notifications.show(`Agente "${agent.name}" eliminato`, 'info');
        
        return true;
    }

    getAgent(id) {
        return this.agents.find(a => a.id === id);
    }

    getAllAgents() {
        return [...this.agents];
    }

    buildInstructions(role, format) {
        let instructions = role;

        const formatInstructions = {
            markdown: '\n\nIMPORTANTE: Formatta il tuo output come Markdown pulito e ben strutturato. Usa intestazioni, liste ed enfasi dove appropriato.',
            json: '\n\nIMPORTANTE: Il tuo output DEVE essere solo JSON valido. Non includere testo prima o dopo l\'oggetto JSON. Assicura formattazione corretta e sintassi valida.',
            html: '\n\nIMPORTANTE: Formatta il tuo output come HTML pulito e semantico. Usa tag e struttura appropriati.',
            csv: '\n\nIMPORTANTE: Formatta il tuo output come dati CSV. Usa delimitatori corretti ed esegui l\'escape dei caratteri speciali.',
            text: ''
        };

        return instructions + (formatInstructions[format] || '');
    }

    validateAgent(agentData) {
        const errors = [];

        if (!agentData.name || agentData.name.trim().length === 0) {
            errors.push('Il nome dell\'agente è richiesto');
        }

        if (!agentData.role || agentData.role.trim().length < 10) {
            errors.push('La descrizione del ruolo deve essere di almeno 10 caratteri');
        }

        if (agentData.name && this.agents.some(a => a.name === agentData.name && a.id !== agentData.editingId)) {
            errors.push('Esiste già un agente con questo nome');
        }

        return errors;
    }
}