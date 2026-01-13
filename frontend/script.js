const API_URL = 'https://testcrosscircles-production.up.railway.app';

class TicTacToe {
    constructor() {
        this.board = Array(9).fill('');
        this.currentPlayer = 'X';
        this.gameOver = false;
        this.isComputerTurn = false; // Флаг для отслеживания хода компьютера
        this.cells = document.querySelectorAll('.cell');
        this.currentPlayerText = document.querySelector('.current-player');
        this.modal = document.getElementById('resultModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalMessage = document.getElementById('modalMessage');
        this.promoCode = document.getElementById('promoCode');
        this.playAgainBtn = document.getElementById('playAgainBtn');
        
        // Получаем chatId из URL параметров
        const urlParams = new URLSearchParams(window.location.search);
        this.chatId = urlParams.get('chatId');
        
        this.init();
    }
    
    init() {
        this.cells.forEach((cell, index) => {
            cell.addEventListener('click', () => this.handleCellClick(index));
        });
        
        this.playAgainBtn.addEventListener('click', () => this.resetGame());
    }
    
    handleCellClick(index) {
        // Блокируем клики если игра окончена, клетка занята или ходит компьютер
        if (this.gameOver || this.board[index] !== '' || this.isComputerTurn) {
            return;
        }
        
        // Ход игрока
        this.makeMove(index, 'X');
        
        if (this.checkWinner('X')) {
            this.endGame('win');
            return;
        }
        
        if (this.isBoardFull()) {
            this.endGame('draw');
            return;
        }
        
        // Блокируем поле и показываем, что ходит компьютер
        this.blockBoard();
        this.currentPlayerText.textContent = '🤔 Ход компьютера...';
        
        // Ход компьютера
        setTimeout(() => {
            const computerMove = this.getComputerMove();
            if (computerMove !== -1) {
                this.makeMove(computerMove, 'O');
                
                if (this.checkWinner('O')) {
                    this.endGame('lose');
                    return;
                }
                
                if (this.isBoardFull()) {
                    this.endGame('draw');
                    return;
                }
            }
            
            // Разблокируем поле после хода компьютера
            this.unblockBoard();
            this.currentPlayerText.textContent = 'Ваш ход!';
        }, 500);
    }
    
    makeMove(index, player) {
        this.board[index] = player;
        const cell = this.cells[index];
        cell.textContent = player;
        cell.classList.add(player.toLowerCase());
        cell.classList.add('disabled');
    }
    
    getComputerMove() {
        // // Простая стратегия: сначала пытаемся выиграть, потом блокируем, потом случайный ход
        // const winMove = this.findWinningMove('O');
        // if (winMove !== -1) return winMove;
        //
        // const blockMove = this.findWinningMove('X');
        // if (blockMove !== -1) return blockMove;
        //
        // // Центр
        // if (this.board[4] === '') return 4;
        //
        // // Углы
        // const corners = [0, 2, 6, 8];
        // const availableCorners = corners.filter(i => this.board[i] === '');
        // if (availableCorners.length > 0) {
        //     return availableCorners[Math.floor(Math.random() * availableCorners.length)];
        // }
        
        // Любая доступная клетка
        const available = this.board.map((cell, index) => cell === '' ? index : -1).filter(i => i !== -1);
        if (available.length > 0) {
            return available[Math.floor(Math.random() * available.length)];
        }
        
        return -1;
    }
    
    findWinningMove(player) {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // строки
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // столбцы
            [0, 4, 8], [2, 4, 6] // диагонали
        ];
        
        for (const line of lines) {
            const [a, b, c] = line;
            const values = [this.board[a], this.board[b], this.board[c]];
            const playerCount = values.filter(v => v === player).length;
            const emptyCount = values.filter(v => v === '').length;
            
            if (playerCount === 2 && emptyCount === 1) {
                const emptyIndex = line.find(i => this.board[i] === '');
                return emptyIndex;
            }
        }
        
        return -1;
    }
    
    checkWinner(player) {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // строки
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // столбцы
            [0, 4, 8], [2, 4, 6] // диагонали
        ];
        
        return lines.some(line => {
            const [a, b, c] = line;
            return this.board[a] === player && 
                   this.board[b] === player && 
                   this.board[c] === player;
        });
    }
    
    isBoardFull() {
        return this.board.every(cell => cell !== '');
    }
    
    generatePromoCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    async endGame(result) {
        this.gameOver = true;
        
        if (result === 'win') {
            const promoCode = this.generatePromoCode();
            this.modalTitle.textContent = '🎉 Поздравляем! 🎉';
            this.modalMessage.textContent = 'Вы выиграли!';
            this.promoCode.textContent = promoCode;
            this.promoCode.style.display = 'block';
            
            // Отправка в Telegram
            console.log('test')
            if (this.chatId) {
                try {
                    await fetch(`${API_URL}/api/telegram/win`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ promoCode, chatId: this.chatId }),
                    });
                } catch (error) {
                    console.error('Ошибка отправки в Telegram:', error);
                }
            }
        } else if (result === 'lose') {
            this.modalTitle.textContent = '😔 Игра окончена';
            this.modalMessage.textContent = 'К сожалению, вы проиграли. Хотите попробовать ещё раз?';
            this.promoCode.style.display = 'none';
            
            // Отправка в Telegram
            if (this.chatId) {
                try {
                    await fetch(`${API_URL}/api/telegram/lose`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ chatId: this.chatId }),
                    });
                } catch (error) {
                    console.error('Ошибка отправки в Telegram:', error);
                }
            }
        } else {
            this.modalTitle.textContent = '🤝 Ничья!';
            this.modalMessage.textContent = 'Игра закончилась вничью. Хотите попробовать ещё раз?';
            this.promoCode.style.display = 'none';
        }
        
        this.modal.classList.add('show');
    }
    
    blockBoard() {
        this.isComputerTurn = true;
        this.cells.forEach(cell => {
            if (!cell.classList.contains('disabled')) {
                cell.classList.add('disabled');
                cell.style.pointerEvents = 'none';
                cell.style.opacity = '0.6';
            }
        });
    }
    
    unblockBoard() {
        this.isComputerTurn = false;
        this.cells.forEach(cell => {
            // Разблокируем только свободные клетки
            if (cell.textContent === '') {
                cell.classList.remove('disabled');
                cell.style.pointerEvents = 'auto';
                cell.style.opacity = '1';
            }
        });
    }
    
    resetGame() {
        this.board = Array(9).fill('');
        this.currentPlayer = 'X';
        this.gameOver = false;
        this.isComputerTurn = false;
        this.modal.classList.remove('show');
        
        this.cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('x', 'o', 'disabled');
            cell.style.pointerEvents = 'auto';
            cell.style.opacity = '1';
        });
        
        this.currentPlayerText.textContent = 'Ваш ход!';
    }
}

// Инициализация игры при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new TicTacToe();
});

