export class APIService {
    constructor() {
        this.geminiKey = null;
        this.tavilyKey = null;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';
        this.tavilyUrl = 'https://api.tavily.com/search';
        
        this.tools = [{
            "functionDeclarations": [{
                "name": "web_search",
                "description": "Search the web for current information, news, or data",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "query": {
                            "type": "STRING",
                            "description": "The search query"
                        }
                    },
                    "required": ["query"]
                }
            }]
        }];
    }

    setApiKeys(geminiKey, tavilyKey = null) {
        this.geminiKey = geminiKey;
        this.tavilyKey = tavilyKey;
        
        // Save to storage for convenience (with user permission)
        if (geminiKey && confirm('Salvare la chiave API per sessioni future?')) {
            window.app.storage.set('gemini_api_key', geminiKey);
        }
        if (tavilyKey) {
            window.app.storage.set('tavily_api_key', tavilyKey);
        }
    }

    hasTavilyKey() {
        return !!this.tavilyKey;
    }

    async callGemini(prompt) {
        if (!this.geminiKey) {
            throw new Error('Chiave API Gemini non impostata');
        }

        const url = `${this.baseUrl}?key=${this.geminiKey}`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: prompt }]
                    }],
                    tools: this.tavilyKey ? this.tools : undefined,
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 4096
                    }
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Richiesta API fallita');
            }

            const data = await response.json();
            
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('Nessuna risposta dall\'API');
            }

            // Check if tool use is requested
            const candidate = data.candidates[0];
            if (candidate.content?.parts?.[0]?.functionCall) {
                const functionCall = candidate.content.parts[0].functionCall;
                if (functionCall.name === 'web_search' && this.tavilyKey) {
                    const searchResults = await this.searchWeb(functionCall.args.query);
                    // Call again with search results
                    return await this.callGeminiWithContext(prompt, searchResults);
                }
            }

            return candidate.content?.parts?.[0]?.text || '';
            
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw new Error(`Errore API Gemini: ${error.message}`);
        }
    }

    async callGeminiWithContext(originalPrompt, searchResults) {
        const enhancedPrompt = `${originalPrompt}\n\nWeb Search Results:\n${searchResults}\n\nBased on the above information, please provide your response.`;
        
        const response = await fetch(`${this.baseUrl}?key=${this.geminiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [{ text: enhancedPrompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 4096
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Richiesta API fallita');
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    async searchWeb(query) {
        if (!this.tavilyKey) {
            console.warn('Chiave API Tavily non impostata, salto ricerca web');
            return '';
        }

        try {
            const response = await fetch(this.tavilyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    api_key: this.tavilyKey,
                    query: query,
                    search_depth: 'basic',
                    max_results: 5,
                    include_answer: true,
                    include_raw_content: false
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Richiesta API di ricerca fallita');
            }

            const data = await response.json();
            
            // Format results
            let formatted = '';
            if (data.answer) {
                formatted += `Answer: ${data.answer}\n\n`;
            }
            
            if (data.results && data.results.length > 0) {
                formatted += 'Sources:\n';
                data.results.forEach((result, index) => {
                    formatted += `${index + 1}. ${result.title}\n`;
                    formatted += `   URL: ${result.url}\n`;
                    formatted += `   ${result.content.substring(0, 200)}...\n\n`;
                });
            }

            return formatted;
            
        } catch (error) {
            console.error('Tavily Search Error:', error);
            return `Ricerca fallita: ${error.message}`;
        }
    }

    async testConnection() {
        try {
            const response = await this.callGemini('Hello, please respond with "Connection successful"');
            return response.includes('successful');
        } catch (error) {
            return false;
        }
    }
}