import { Controller, Post, Body, Get } from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Controller('api/telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}
  @Get('/test')
  getTest(){
    return "test"
  }
  @Post('win')
  async sendWin(@Body() body: { promoCode: string; chatId?: string }) {
    await this.telegramService.sendWinMessage(body.promoCode, body.chatId);
    return { success: true };
  }

  @Post('lose')
  async sendLose(@Body() body: { chatId?: string }) {
    await this.telegramService.sendLoseMessage(body.chatId);
    return { success: true };
  }
}

