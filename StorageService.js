export class StorageService {
    constructor() {
        this.prefix = 'ai_orchestrator_';
        this.checkStorageAvailability();
    }

    checkStorageAvailability() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            this.available = true;
        } catch (e) {
            this.available = false;
            console.warn('LocalStorage not available, using memory storage');
            this.memoryStorage = {};
        }
    }

    set(key, value) {
        const fullKey = this.prefix + key;
        const serialized = JSON.stringify(value);
        
        if (this.available) {
            try {
                localStorage.setItem(fullKey, serialized);
                return true;
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    console.error('Storage quota exceeded');
                    this.cleanup();
                    try {
                        localStorage.setItem(fullKey, serialized);
                        return true;
                    } catch (e) {
                        return false;
                    }
                }
            }
        } else {
            this.memoryStorage[fullKey] = serialized;
            return true;
        }
    }

    get(key, defaultValue = null) {
        const fullKey = this.prefix + key;
        
        try {
            const item = this.available ? 
                localStorage.getItem(fullKey) : 
                this.memoryStorage[fullKey];
            
            if (item === null || item === undefined) {
                return defaultValue;
            }
            
            return JSON.parse(item);
        } catch (e) {
            console.error('Error parsing stored data:', e);
            return defaultValue;
        }
    }

    remove(key) {
        const fullKey = this.prefix + key;
        
        if (this.available) {
            localStorage.removeItem(fullKey);
        } else {
            delete this.memoryStorage[fullKey];
        }
    }

    clear() {
        if (this.available) {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
        } else {
            Object.keys(this.memoryStorage).forEach(key => {
                if (key.startsWith(this.prefix)) {
                    delete this.memoryStorage[key];
                }
            });
        }
    }

    cleanup() {
        // Remove old or unnecessary data
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        if (this.available) {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        if (data.timestamp && (now - data.timestamp) > maxAge) {
                            localStorage.removeItem(key);
                        }
                    } catch (e) {
                        // If can't parse, it's probably corrupted, remove it
                        localStorage.removeItem(key);
                    }
                }
            });
        }
    }

    getSize() {
        let size = 0;
        
        if (this.available) {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(this.prefix)) {
                    size += localStorage.getItem(key).length;
                }
            });
        } else {
            Object.keys(this.memoryStorage).forEach(key => {
                if (key.startsWith(this.prefix)) {
                    size += this.memoryStorage[key].length;
                }
            });
        }
        
        return size;
    }

    export() {
        const data = {};
        
        if (this.available) {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(this.prefix)) {
                    const cleanKey = key.replace(this.prefix, '');
                    try {
                        data[cleanKey] = JSON.parse(localStorage.getItem(key));
                    } catch (e) {
                        console.error(`Failed to export ${key}:`, e);
                    }
                }
            });
        } else {
            Object.keys(this.memoryStorage).forEach(key => {
                if (key.startsWith(this.prefix)) {
                    const cleanKey = key.replace(this.prefix, '');
                    try {
                        data[cleanKey] = JSON.parse(this.memoryStorage[key]);
                    } catch (e) {
                        console.error(`Failed to export ${key}:`, e);
                    }
                }
            });
        }
        
        return data;
    }

    import(data) {
        Object.keys(data).forEach(key => {
            this.set(key, data[key]);
        });
    }
}