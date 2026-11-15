import { Inject, Injectable } from '@nestjs/common';
import { CONFIGURACION, type Configuracion } from '../config/environment.js';
import { EnviadorPush, type MensajePush } from '../common/notifications/ports.js';

interface TicketExpo {
  status?: string;
  details?: { error?: string };
}

interface RespuestaExpo {
  data?: TicketExpo[] | TicketExpo;
  errors?: unknown;
}

/** Envía las notificaciones a Expo en tandas de hasta 100 teléfonos. */
@Injectable()
export class EnviadorPorHacer extends EnviadorPush {
  constructor(@Inject(CONFIGURACION) private readonly config: Configuracion) {
    super();
  }

  async enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    const pendientes = mensajes.flatMap((mensaje) =>
      mensaje.tokens.map((to) => ({
        to,
        title: mensaje.titulo,
        body: mensaje.cuerpo,
        data: mensaje.datos,
      })),
    );
    if (pendientes.length === 0) return { tokensInvalidos: [] };

    const tokensInvalidos: string[] = [];
    for (let inicio = 0; inicio < pendientes.length; inicio += 100) {
      const tanda = pendientes.slice(inicio, inicio + 100);
      const respuesta = await fetch(this.config.expoPushUrl, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(tanda),
      });

      if (!respuesta.ok) {
        throw new Error(`Expo rechazó el envío de notificaciones (HTTP ${respuesta.status}).`);
      }

      let cuerpo: RespuestaExpo;
      try {
        cuerpo = (await respuesta.json()) as RespuestaExpo;
      } catch (error) {
        throw new Error('Expo devolvió una respuesta que no es JSON válido.', { cause: error });
      }

      if (!Array.isArray(cuerpo.data) || cuerpo.data.length !== tanda.length) {
        throw new Error('Expo devolvió una cantidad de tickets distinta a la cantidad de mensajes enviados.');
      }

      cuerpo.data.forEach((ticket, indice) => {
        if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          tokensInvalidos.push(tanda[indice].to);
        } else if (ticket?.status !== 'ok') {
          throw new Error(
            ticket?.status === 'error'
              ? `Expo no pudo entregar una notificación (${ticket.details?.error ?? 'error desconocido'}).`
              : 'Expo devolvió un ticket de notificación con formato inválido.',
          );
        }
      });
    }

    return { tokensInvalidos: [...new Set(tokensInvalidos)] };
  }
}
