export class WorkflowEngine {
    constructor(api, notifications) {
        this.api = api;
        this.notifications = notifications;
        this.sequence = [];
        this.contextFiles = [];
        this.executionHistory = [];
    }

    addToSequence(agentId) {
        if (!this.sequence.find(a => a === agentId)) {
            this.sequence.push(agentId);
        }
    }

    removeFromSequence(agentId) {
        this.sequence = this.sequence.filter(id => id !== agentId);
    }

    clearSequence() {
        this.sequence = [];
    }

    reorderSequence(fromIndex, toIndex) {
        const [removed] = this.sequence.splice(fromIndex, 1);
        this.sequence.splice(toIndex, 0, removed);
    }

    addContext(file) {
        this.contextFiles.push(file);
    }

    clearContext() {
        this.contextFiles = [];
    }

    async execute(userPrompt, progressCallback, outputCallback) {
        this.executionHistory = [];
        let previousOutput = userPrompt;
        
        // Add context files to initial prompt
        if (this.contextFiles.length > 0) {
            previousOutput += '\n\n--- CONTEXT FILES ---\n';
            for (const file of this.contextFiles) {
                previousOutput += `\nFile: ${file.name}\n${file.content}\n`;
            }
            previousOutput += '--- END CONTEXT ---\n';
        }

        const totalSteps = this.sequence.length;
        
        for (let i = 0; i < totalSteps; i++) {
            const agentId = this.sequence[i];
            const agent = window.app.agentManager.getAgent(agentId);
            
            if (!agent) {
                throw new Error(`Agente non trovato: ${agentId}`);
            }

            progressCallback({
                current: i + 1,
                total: totalSteps,
                agent: agent.name,
                status: 'executing'
            });

            outputCallback({
                type: 'system',
                content: `Esecuzione Agente ${i + 1}/${totalSteps}: ${agent.name}`,
                timestamp: new Date().toISOString()
            });

            try {
                const response = await this.executeAgent(agent, previousOutput, i === 0);
                
                this.executionHistory.push({
                    agent: agent.name,
                    input: previousOutput,
                    output: response,
                    timestamp: new Date().toISOString()
                });

                outputCallback({
                    type: 'agent',
                    agent: agent.name,
                    content: response,
                    timestamp: new Date().toISOString()
                });

                previousOutput = response;

            } catch (error) {
                outputCallback({
                    type: 'error',
                    content: `Errore in ${agent.name}: ${error.message}`,
                    timestamp: new Date().toISOString()
                });
                throw error;
            }
        }

        progressCallback({
            current: totalSteps,
            total: totalSteps,
            status: 'completed'
        });

        outputCallback({
            type: 'success',
            content: 'Flusso di lavoro completato con successo!',
            timestamp: new Date().toISOString()
        });

        return this.executionHistory;
    }

    async executeAgent(agent, input, isFirst) {
        const prompt = this.buildPrompt(agent, input, isFirst);
        
        // Check if agent needs web search
        const needsSearch = this.detectSearchNeed(input, agent.role);
        
        if (needsSearch && this.api.hasTavilyKey()) {
            const searchQuery = this.extractSearchQuery(input, agent.role);
            if (searchQuery) {
                try {
                    const searchResults = await this.api.searchWeb(searchQuery);
                    input += `\n\nWeb Search Results:\n${searchResults}`;
                } catch (error) {
                    console.error('Search failed:', error);
                }
            }
        }

        const response = await this.api.callGemini(prompt);
        return this.formatResponse(response, agent.format);
    }

    buildPrompt(agent, input, isFirst) {
        if (isFirst) {
            return `${agent.instructions}\n\nRichiesta Utente:\n${input}\n\nElabora questa richiesta secondo il tuo ruolo e formato di output.`;
        } else {
            return `${agent.instructions}\n\nOutput Agente Precedente:\n${input}\n\nElabora questo input secondo il tuo ruolo e formato di output.`;
        }
    }

    detectSearchNeed(input, role) {
        const searchKeywords = [
            'search', 'find', 'latest', 'current', 'recent', 
            'news', 'update', 'research', 'information about'
        ];
        
        const combined = (input + role).toLowerCase();
        return searchKeywords.some(keyword => combined.includes(keyword));
    }

    extractSearchQuery(input, role) {
        // Simple extraction logic - can be enhanced
        const lines = input.split('\n');
        for (const line of lines) {
            if (line.toLowerCase().includes('search') || 
                line.toLowerCase().includes('find') ||
                line.toLowerCase().includes('research')) {
                return line.replace(/search|find|research|for|about|on/gi, '').trim();
            }
        }
        return null;
    }

    formatResponse(response, format) {
        // Clean and format response based on output type
        let formatted = response.trim();
        
        if (format === 'json') {
            try {
                // Try to extract JSON if mixed with text
                const jsonMatch = formatted.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    formatted = JSON.stringify(parsed, null, 2);
                }
            } catch (e) {
                console.error('JSON formatting failed:', e);
            }
        }
        
        return formatted;
    }

    getExecutionHistory() {
        return this.executionHistory;
    }

    exportWorkflow() {
        return {
            sequence: this.sequence,
            agents: this.sequence.map(id => window.app.agentManager.getAgent(id)),
            created: new Date().toISOString()
        };
    }

    importWorkflow(workflowData) {
        this.sequence = workflowData.sequence || [];
        // Validate that agents exist
        this.sequence = this.sequence.filter(id => window.app.agentManager.getAgent(id));
    }
}