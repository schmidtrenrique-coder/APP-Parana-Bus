import { Entity, PrimaryColumn } from 'typeorm';
import { ColumnaReferencia, ColumnaEnum } from '../common/db/columns.js';
import type { Plataforma } from '../common/notifications/ports.js';

/** Un token por teléfono. La clave primaria garantiza unicidad incluso con altas simultáneas. */
@Entity('tokens_push')
export class TokenPushEntidad {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  tokenExpo: string;

  @ColumnaReferencia()
  usuarioId: string;

  @ColumnaEnum()
  plataforma: Plataforma;
}
