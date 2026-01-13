import { Injectable, OnModuleInit } from '@nestjs/common';
import { Telegraf, Markup } from 'telegraf';

interface GameState {
  board: string[];
  gameOver: boolean;
  messageId?: number;
}

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Telegraf;
  private games: Map<number, GameState> = new Map();

  constructor() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      console.warn('TELEGRAM_BOT_TOKEN не установлен. Telegram бот не будет работать.');
      return;
    }
    
    this.bot = new Telegraf(botToken);
  }

  async onModuleInit() {
    if (!this.bot) return;
    
    // Обработчик команды /start
    this.bot.start((ctx) => {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      const chatId = ctx.chat?.id || ctx.from?.id;
      const gameUrl = `${frontendUrl}?chatId=${chatId}`;
      
      ctx.reply(
        '✨ Привет! Давай сыграем в крестики-нолики! ✨\n\n' +
        'Доступные команды:\n' +
        '🎮 /game - Играть прямо в боте\n' +
        // '🌐 /site - Играть на сайте\n\n' +
        'Ты играешь крестиками (X), я - ноликами (O).'+
          'После победы я вышлю тебе промокод 🙃',
        Markup.keyboard([
          ['🎮 /game']
        ]).resize()
      );
    });

    // Обработчик команды /game
    this.bot.command('game', (ctx) => {
      this.startNewGame(ctx);
    });

    // Обработчик команды /site
    // this.bot.command('site', (ctx) => {
    //   const frontendUrl = process.env.FRONTEND_URL || 'https://google.com';
    //   const chatId = ctx.chat?.id || ctx.from?.id;
    //   const gameUrl = `${frontendUrl}?chatId=${chatId}`;
    //
    //   ctx.reply(
    //     '🌐 Игра на сайте\n\n' +
    //     'Перейди по ссылке, чтобы играть в красивом интерфейсе:\n\n' +
    //     `<a href="${gameUrl}">🎮 Начать игру</a>`,
    //     {
    //       parse_mode: 'HTML',
    //       reply_markup: Markup.inlineKeyboard([
    //         [Markup.button.url('🎮 Открыть игру', gameUrl)]
    //       ]).reply_markup
    //     }
    //   );
    // });

    // Обработчик callback от inline-кнопок
    this.bot.action(/^move_(\d+)$/, async (ctx) => {
      await this.handleMove(ctx);
    });

    // Обработчик кнопки "Новая игра"
    this.bot.action('new_game', async (ctx) => {
      await this.startNewGame(ctx);
      await ctx.answerCbQuery();
    });
    
    // Запускаем бота асинхронно, не блокируя основной поток
    this.bot.launch().then(() => {
      console.log('✅ Telegram бот запущен');
    }).catch((error) => {
      console.error('❌ Ошибка запуска Telegram бота:', error);
    });
  }

  private startNewGame(ctx: any) {
    const chatId = ctx.chat?.id || ctx.from?.id;
    if (!chatId) return;

    const gameState: GameState = {
      board: Array(9).fill(''),
      gameOver: false,
    };

    this.games.set(chatId, gameState);

    const message = this.formatGameMessage(gameState);
    const keyboard = this.createGameKeyboard(gameState);

    if (ctx.callbackQuery) {
      // Обновляем существующее сообщение
      ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
      });
    } else {
      // Отправляем новое сообщение
      ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
      });
    }
  }

  private async handleMove(ctx: any) {
    const chatId = ctx.from.id;
    const gameState = this.games.get(chatId);

    if (!gameState || gameState.gameOver) {
      await ctx.answerCbQuery('Игра не активна. Начни новую игру командой /game');
      return;
    }

    const moveIndex = parseInt(ctx.match[1]);
    
    // Проверяем, что клетка свободна
    if (gameState.board[moveIndex] !== '') {
      await ctx.answerCbQuery('Эта клетка уже занята!');
      return;
    }

    // Ход игрока
    gameState.board[moveIndex] = 'X';

    // Проверяем победу игрока
    if (this.checkWinner(gameState.board, 'X')) {
      gameState.gameOver = true;
      const promoCode = this.generatePromoCode();
      
      const message = this.formatGameMessage(gameState, 'win', promoCode);
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎮 Играть ещё раз', 'new_game')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
      });

      // Отправляем уведомление о победе
      await ctx.telegram.sendMessage(
        chatId,
        `🎉 Победа! Промокод выдан: <b>${promoCode}</b>`,
        { parse_mode: 'HTML' }
      );

      await ctx.answerCbQuery('🎉 Вы выиграли!');
      this.games.delete(chatId);
      return;
    }

    // Проверяем ничью
    if (this.isBoardFull(gameState.board)) {
      gameState.gameOver = true;
      
      const message = this.formatGameMessage(gameState, 'draw');
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎮 Играть ещё раз', 'new_game')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
      });

      await ctx.answerCbQuery('🤝 Ничья!');
      this.games.delete(chatId);
      return;
    }

    // Ход компьютера
    const computerMove = this.getComputerMove(gameState.board);
    if (computerMove !== -1) {
      gameState.board[computerMove] = 'O';

      // Проверяем победу компьютера
      if (this.checkWinner(gameState.board, 'O')) {
        gameState.gameOver = true;
        
        const message = this.formatGameMessage(gameState, 'lose');
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🎮 Играть ещё раз', 'new_game')]
        ]);

        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup,
        });

        // Отправляем уведомление о проигрыше
        await ctx.telegram.sendMessage(
          chatId,
          '😔 Проигрыш',
        );

        await ctx.answerCbQuery('😔 Вы проиграли');
        this.games.delete(chatId);
        return;
      }

      // Проверяем ничью после хода компьютера
      if (this.isBoardFull(gameState.board)) {
        gameState.gameOver = true;
        
        const message = this.formatGameMessage(gameState, 'draw');
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🎮 Играть ещё раз', 'new_game')]
        ]);

        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup,
        });

        await ctx.answerCbQuery('🤝 Ничья!');
        this.games.delete(chatId);
        return;
      }
    }

    // Обновляем игровое поле
    const message = this.formatGameMessage(gameState);
    const keyboard = this.createGameKeyboard(gameState);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard.reply_markup,
    });

    await ctx.answerCbQuery();
  }

  private formatGameMessage(gameState: GameState, result?: string, promoCode?: string): string {
    const board = gameState.board;
    const emojiMap: { [key: string]: string } = {
      'X': '❌',
      'O': '⭕',
      '': '⬜'
    };

    let message = '✨ <b>Крестики-нолики</b> ✨\n\n';
    
    // Отображаем поле 3x3
    for (let i = 0; i < 3; i++) {
      const row = [];
      for (let j = 0; j < 3; j++) {
        const index = i * 3 + j;
        row.push(emojiMap[board[index]] || '⬜');
      }
      message += row.join(' ') + '\n';
    }

    if (result === 'win') {
      message += '\n🎉 <b>Поздравляем! Вы выиграли!</b>\n';
      // if (promoCode) {
      //   message += `\n🎁 Ваш промокод: <b>${promoCode}</b>`;
      // }
    } else if (result === 'lose') {
      message += '\n😔 <b>К сожалению, вы проиграли.</b>\n';
      message += 'Хотите попробовать ещё раз?';
    } else if (result === 'draw') {
      message += '\n🤝 <b>Ничья!</b>\n';
      message += 'Хотите попробовать ещё раз?';
    } else {
      message += '\nВаш ход! Выберите клетку:';
    }

    return message;
  }

  private createGameKeyboard(gameState: GameState) {
    const board = gameState.board;
    const buttons = [];

    for (let i = 0; i < 3; i++) {
      const row = [];
      for (let j = 0; j < 3; j++) {
        const index = i * 3 + j;
        const cell = board[index];
        
        let label = '⬜';
        if (cell === 'X') label = '❌';
        else if (cell === 'O') label = '⭕';
        else label = '⬜';

        row.push(
          Markup.button.callback(
            label,
            `move_${index}`
          )
        );
      }
      buttons.push(row);
    }

    return Markup.inlineKeyboard(buttons);
  }

  private getComputerMove(board: string[]): number {
    // Упрощенная стратегия: иногда блокируем, но не всегда
    if (Math.random() < 0.5) {
      const blockMove = this.findWinningMove(board, 'X');
      if (blockMove !== -1) {
        return blockMove;
      }
    }

    // Случайный ход
    const available = board.map((cell, index) => cell === '' ? index : -1).filter(i => i !== -1);
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }

    return -1;
  }

  private findWinningMove(board: string[], player: string): number {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // строки
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // столбцы
      [0, 4, 8], [2, 4, 6] // диагонали
    ];

    for (const line of lines) {
      const [a, b, c] = line;
      const values = [board[a], board[b], board[c]];
      const playerCount = values.filter(v => v === player).length;
      const emptyCount = values.filter(v => v === '').length;

      if (playerCount === 2 && emptyCount === 1) {
        const emptyIndex = line.find(i => board[i] === '');
        return emptyIndex;
      }
    }

    return -1;
  }

  private checkWinner(board: string[], player: string): boolean {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // строки
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // столбцы
      [0, 4, 8], [2, 4, 6] // диагонали
    ];

    return lines.some(line => {
      const [a, b, c] = line;
      return board[a] === player && 
             board[b] === player && 
             board[c] === player;
    });
  }

  private isBoardFull(board: string[]): boolean {
    return board.every(cell => cell !== '');
  }

  private generatePromoCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Методы для отправки уведомлений из frontend
  async sendWinMessage(promoCode: string, chatId?: string): Promise<void> {
    console.log('sent win message');
    if (!this.bot) {
      console.log(`[WIN] Промокод выдан: ${promoCode}`);
      return;
    }
    
    const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
    if (!targetChatId) {
      console.log(`[WIN] Промокод выдан: ${promoCode} (chatId не указан)`);
      return;
    }
    
    try {
      await this.bot.telegram.sendMessage(
        targetChatId,
        `🎉 Победа! Промокод выдан: <b>${promoCode}</b>`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('Ошибка отправки сообщения о победе:', error);
    }
  }

  async sendLoseMessage(chatId?: string): Promise<void> {
    console.log('sent lose message');
    if (!this.bot) {
      console.log('[LOSE] Проигрыш');
      return;
    }
    
    const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
    if (!targetChatId) {
      console.log('[LOSE] Проигрыш (chatId не указан)');
      return;
    }
    
    try {
      await this.bot.telegram.sendMessage(
        targetChatId,
        '😔 Проигрыш'
      );
    } catch (error) {
      console.error('Ошибка отправки сообщения о проигрыше:', error);
    }
  }
}
