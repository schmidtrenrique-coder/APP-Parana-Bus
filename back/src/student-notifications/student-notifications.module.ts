import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlmacenTokensPush, EnviadorPush } from '../common/notifications/ports.js';
import { AlmacenTokensPorHacer } from './todo-token-store.js';
import { EnviadorPorHacer } from './todo-sender.js';
import { TokenPushEntidad } from './push-token.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([TokenPushEntidad])],
  providers: [
    { provide: AlmacenTokensPush, useClass: AlmacenTokensPorHacer },
    { provide: EnviadorPush, useClass: EnviadorPorHacer },
  ],
  exports: [AlmacenTokensPush, EnviadorPush],
})
export class NotificacionesAlumnosModulo {}
