export class NotificationService {
    constructor() {
        this.container = null;
        this.queue = [];
        this.init();
    }

    init() {
        // Get or create container
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'fixed bottom-4 right-4 z-50 space-y-2';
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'info', duration = 4000) {
        const toast = this.createToast(message, type);
        
        // Add to container
        this.container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        }, 10);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                this.remove(toast);
            }, duration);
        }

        return toast;
    }

    createToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'check_circle',
            error: 'error',
            warning: 'warning',
            info: 'info'
        };

        const colors = {
            success: 'text-green-400',
            error: 'text-red-400',
            warning: 'text-yellow-400',
            info: 'text-blue-400'
        };

        toast.innerHTML = `
            <span class="material-icons-outlined ${colors[type]}">${icons[type]}</span>
            <span class="flex-1">${this.escapeHtml(message)}</span>
            <button class="ml-4 text-gray-400 hover:text-gray-200">
                <span class="material-icons-outlined text-sm">close</span>
            </button>
        `;

        // Style for initial state
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        toast.style.transition = 'all 0.3s ease';

        // Close button
        toast.querySelector('button').addEventListener('click', () => {
            this.remove(toast);
        });

        return toast;
    }

    remove(toast) {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 300);
    }

    clear() {
        const toasts = this.container.querySelectorAll('.toast');
        toasts.forEach(toast => this.remove(toast));
    }

    success(message, duration = 4000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 6000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 4000) {
        return this.show(message, 'info', duration);
    }

    confirm(message, onConfirm, onCancel) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
        modal.innerHTML = `
            <div class="glass-card p-6 max-w-md mx-4">
                <h3 class="text-lg font-bold mb-4">Confirm</h3>
                <p class="mb-6">${this.escapeHtml(message)}</p>
                <div class="flex gap-3 justify-end">
                    <button class="btn-secondary" id="cancel-btn">Cancel</button>
                    <button class="btn-primary" id="confirm-btn">Confirm</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#confirm-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            if (onConfirm) onConfirm();
        });

        modal.querySelector('#cancel-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            if (onCancel) onCancel();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                if (onCancel) onCancel();
            }
        });
    }

    prompt(title, message, defaultValue = '', onSubmit, onCancel) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
        modal.innerHTML = `
            <div class="glass-card p-6 max-w-md mx-4">
                <h3 class="text-lg font-bold mb-4">${this.escapeHtml(title)}</h3>
                <p class="mb-4">${this.escapeHtml(message)}</p>
                <input type="text" class="input-field w-full mb-6" value="${this.escapeHtml(defaultValue)}" id="prompt-input">
                <div class="flex gap-3 justify-end">
                    <button class="btn-secondary" id="cancel-btn">Cancel</button>
                    <button class="btn-primary" id="submit-btn">Submit</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const input = modal.querySelector('#prompt-input');
        input.focus();
        input.select();

        const submit = () => {
            const value = input.value.trim();
            document.body.removeChild(modal);
            if (onSubmit) onSubmit(value);
        };

        modal.querySelector('#submit-btn').addEventListener('click', submit);
        modal.querySelector('#cancel-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            if (onCancel) onCancel();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                if (onCancel) onCancel();
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                if (onCancel) onCancel();
            }
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}