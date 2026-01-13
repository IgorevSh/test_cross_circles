import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Включаем CORS для работы с frontend
  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: '*',
  });
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap().catch(err => {
  console.error('❌ Application bootstrap failed', err);
  process.exit(1);
});
