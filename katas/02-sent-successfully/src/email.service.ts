/**
 * Email service for sending notifications
 */

import {
  formatOccupiedEmailHTML,
  formatOccupiedEmailText,
  formatReservationEmailHTML,
  formatReservationEmailText,
  LOGO_CID,
} from "./templates";
import type {
  Logger,
  OccupiedEmailDetails,
  ReservationEmailDetails,
  Transport,
} from "./types";

/** Path to the logo image file */
const LOGO_PATH = "./assets/bitua-logo.png";

export interface EmailServiceConfig {
  from: string;
  /** Recipients for all notification emails (max 12) */
  recipients: string[];
}

export interface EmailServiceDeps {
  transport: Transport;
  logger: Logger;
}

export interface EmailService {
  sendReservationEmail(
    details: ReservationEmailDetails,
    changesCount: number,
    recipients?: string[],
  ): Promise<void>;
  sendOccupiedEmail(
    details: OccupiedEmailDetails,
    recipientEmail: string,
  ): Promise<void>;
}

/**
 * Create email service with SMTP configuration
 */
export function createEmailService(
  serviceConfig: EmailServiceConfig,
  deps: EmailServiceDeps,
): EmailService {
  const { from, recipients } = serviceConfig;
  const { transport, logger } = deps;

  async function sendReservationEmail(
    details: ReservationEmailDetails,
    changesCount: number,
    overrideRecipients?: string[],
  ): Promise<void> {
    const targetRecipients = overrideRecipients ?? recipients;

    try {
      if (targetRecipients.length === 0) {
        logger.warn(
          "[Notifications] No recipients configured. Skipping reservation email.",
        );
        return;
      }

      logger.info(
        `[Notifications] Sending reservation email to ${targetRecipients.length} recipient(s): ${targetRecipients.join(", ")}`,
      );

      const htmlContent = formatReservationEmailHTML(details, changesCount);
      const textContent = formatReservationEmailText(details, changesCount);

      // Build subject: "Nombre quien reserva - Reserva n maletas para 'Institución' el día mes hora"
      const creadoPor = details["Creado por"] || "N/A";
      const institucion = details["Institución"] || "N/A";
      const fechaCorta = details["Fecha corta"] || "";
      const subject = `${creadoPor} - Reserva ${changesCount} maleta${changesCount > 1 ? "s" : ""} para '${institucion}' el ${fechaCorta}`;

      // Send mail with logo attachment
      const info = await transport.sendMail({
        from,
        to: targetRecipients.join(", "),
        subject,
        text: textContent,
        html: htmlContent,
        attachments: [
          {
            filename: "bitua-logo.png",
            path: LOGO_PATH,
            cid: LOGO_CID,
          },
        ],
      });

      logger.info("[Notifications] Reservation email sent successfully", {
        messageId: info.messageId,
        recipients: targetRecipients.join(", "),
      });
    } catch (error) {
      logger.error("[Notifications] Error sending reservation email", {
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Send occupied notification email to the reservation creator
   */
  async function sendOccupiedEmail(
    details: OccupiedEmailDetails,
    recipientEmail: string,
  ): Promise<void> {
    try {
      if (!recipientEmail) {
        logger.warn(
          "[Notifications] No recipient email provided. Skipping occupied email.",
        );
        return;
      }

      logger.info(
        `[Notifications] Sending occupied email to: ${recipientEmail}`,
      );

      const htmlContent = formatOccupiedEmailHTML(details);
      const textContent = formatOccupiedEmailText(details);

      // Build subject: "Maleta(s) entregada(s) - {Institución} ({Código maleta})"
      const institucion = details["Institución"] || "N/A";
      const codigoMaleta = details["Código de maleta"] || "N/A";
      const subject = `Maleta(s) entregada(s) - ${institucion} (${codigoMaleta})`;

      // Send mail with logo attachment
      const info = await transport.sendMail({
        from,
        to: recipientEmail,
        subject,
        text: textContent,
        html: htmlContent,
        attachments: [
          {
            filename: "bitua-logo.png",
            path: LOGO_PATH,
            cid: LOGO_CID,
          },
        ],
      });

      logger.info("[Notifications] Occupied email sent successfully", {
        messageId: info.messageId,
        recipient: recipientEmail,
      });
    } catch (error) {
      logger.error("[Notifications] Error sending occupied email", {
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  return {
    sendReservationEmail,
    sendOccupiedEmail,
  };
}
