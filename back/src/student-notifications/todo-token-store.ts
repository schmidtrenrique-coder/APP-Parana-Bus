import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AlmacenTokensPush, type Plataforma } from '../common/notifications/ports.js';
import { TokenPushEntidad } from './push-token.entity.js';

/** Persistencia de los tokens Expo: un registro por teléfono, único por token. */
@Injectable()
export class AlmacenTokensPorHacer extends AlmacenTokensPush {
  constructor(
    @InjectRepository(TokenPushEntidad)
    private readonly tokens: Repository<TokenPushEntidad>,
  ) {
    super();
  }

  async guardar(usuarioId: string, tokenExpo: string, plataforma: Plataforma): Promise<void> {
    // UPSERT apoyado en la clave primaria: evita duplicados incluso ante pedidos concurrentes.
    await this.tokens.upsert({ tokenExpo, usuarioId, plataforma }, ['tokenExpo']);
  }

  async borrar(tokenExpo: string): Promise<void> {
    await this.tokens.delete({ tokenExpo });
  }

  async tokensDe(usuarioIds: string[]): Promise<string[]> {
    if (usuarioIds.length === 0) return [];
    const registros = await this.tokens.find({
      select: { tokenExpo: true },
      where: { usuarioId: In([...new Set(usuarioIds)]) },
      order: { tokenExpo: 'ASC' },
    });
    return registros.map(({ tokenExpo }) => tokenExpo);
  }

  async descartar(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.tokens.delete({ tokenExpo: In([...new Set(tokens)]) });
  }
}
