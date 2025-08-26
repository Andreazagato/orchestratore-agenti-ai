export class ThemeManager {
    constructor() {
        this.currentTheme = this.loadTheme();
        this.applyTheme();
        this.updateIcon();
    }

    loadTheme() {
        return localStorage.getItem('theme') || 'dark';
    }

    saveTheme(theme) {
        localStorage.setItem('theme', theme);
    }

    applyTheme() {
        if (this.currentTheme === 'light') {
            document.body.setAttribute('data-theme', 'light');
            document.body.classList.remove('bg-gradient-to-br', 'from-slate-950', 'via-blue-950', 'to-slate-950');
            document.body.classList.add('bg-gradient-to-br', 'from-gray-50', 'via-blue-50', 'to-gray-50');
        } else {
            document.body.removeAttribute('data-theme');
            document.body.classList.remove('bg-gradient-to-br', 'from-gray-50', 'via-blue-50', 'to-gray-50');
            document.body.classList.add('bg-gradient-to-br', 'from-slate-950', 'via-blue-950', 'to-slate-950');
        }
    }

    updateIcon() {
        const button = document.getElementById('theme-toggle');
        if (button) {
            const icon = button.querySelector('.material-icons-outlined');
            if (this.currentTheme === 'light') {
                icon.textContent = 'dark_mode';
                icon.classList.remove('text-yellow-400');
                icon.classList.add('text-gray-600');
            } else {
                icon.textContent = 'light_mode';
                icon.classList.remove('text-gray-600');
                icon.classList.add('text-yellow-400');
            }
        }
    }

    toggle() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.saveTheme(this.currentTheme);
        this.applyTheme();
        this.updateIcon();
        
        // Animate transition
        document.body.style.transition = 'background-color 0.3s ease';
        setTimeout(() => {
            document.body.style.transition = '';
        }, 300);
    }

    setTheme(theme) {
        if (theme === 'light' || theme === 'dark') {
            this.currentTheme = theme;
            this.saveTheme(theme);
            this.applyTheme();
            this.updateIcon();
        }
    }

    getTheme() {
        return this.currentTheme;
    }

    // Auto-detect system preference
    detectSystemPreference() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    // Watch for system preference changes
    watchSystemPreference() {
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                const theme = e.matches ? 'dark' : 'light';
                this.setTheme(theme);
            });
        }
    }
}