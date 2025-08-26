export class FileHandler {
    constructor() {
        this.supportedTypes = {
            'text/plain': this.readTextFile,
            'text/csv': this.readTextFile,
            'text/markdown': this.readTextFile,
            'application/json': this.readTextFile,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': this.readDocx,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': this.readXlsx,
            'application/pdf': this.readPdf
        };
    }

    async processFile(file) {
        const handler = this.supportedTypes[file.type] || this.getHandlerByExtension(file.name);
        
        if (!handler) {
            throw new Error(`Tipo di file non supportato: ${file.type || file.name.split('.').pop()}`);
        }

        try {
            const content = await handler.call(this, file);
            return this.sanitizeContent(content);
        } catch (error) {
            throw new Error(`Impossibile processare il file: ${error.message}`);
        }
    }

    getHandlerByExtension(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const handlers = {
            'txt': this.readTextFile,
            'csv': this.readTextFile,
            'md': this.readTextFile,
            'json': this.readTextFile,
            'docx': this.readDocx,
            'xlsx': this.readXlsx,
            'pdf': this.readPdf
        };
        return handlers[ext];
    }

    readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    readDocx(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    if (typeof mammoth === 'undefined') {
                        reject(new Error('Lettore DOCX non disponibile'));
                        return;
                    }
                    const result = await mammoth.extractRawText({
                        arrayBuffer: e.target.result
                    });
                    resolve(result.value);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    readXlsx(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    if (typeof XLSX === 'undefined') {
                        reject(new Error('Lettore XLSX non disponibile'));
                        return;
                    }
                    const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                    let content = '';
                    
                    workbook.SheetNames.forEach((sheetName, index) => {
                        if (index > 0) content += '\n\n';
                        content += `--- Sheet: ${sheetName} ---\n`;
                        const sheet = workbook.Sheets[sheetName];
                        content += XLSX.utils.sheet_to_csv(sheet);
                    });
                    
                    resolve(content);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    async readPdf(file) {
        // PDF reading would require additional library like pdf.js
        // For now, return a placeholder
        return `[Contenuto PDF: ${file.name}]\nLa lettura di PDF richiede configurazione aggiuntiva. Converti in formato testo.`;
    }

    sanitizeContent(content) {
        // Remove potentially harmful content and limit size
        const maxLength = 50000; // 50KB limit
        let sanitized = content.toString();
        
        // Remove script tags and other potentially harmful content
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
        
        // Limit length
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength) + '\n\n[Contenuto troncato...]';
        }
        
        return sanitized;
    }

    async downloadContent(content, fileName = 'output.txt') {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}