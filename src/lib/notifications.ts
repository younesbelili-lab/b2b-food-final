type OrderNotificationPayload = {
  orderId: string;
  clientEmail?: string;
  clientCompany?: string;
  deliveryDate: string;
  totalTtc: number;
  recurrence?: string;
};

type StatusNotificationPayload = OrderNotificationPayload & {
  status: string;
};

function euro(value: number) {
  return `${value.toFixed(2)} EUR`;
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const from = process.env.RESEND_FROM_EMAIL ?? process.env.MAIL_FROM ?? "";
  return { apiKey, from };
}

async function sendMail(input: { to: string; subject: string; html: string; text: string }) {
  const { apiKey, from } = getResendConfig();
  if (!apiKey || !from) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Email provider error (${response.status}): ${details}`);
  }

  return true;
}

async function safeSendMail(input: { to?: string; subject: string; html: string; text: string }) {
  if (!input.to) {
    return;
  }
  try {
    await sendMail({ to: input.to, subject: input.subject, html: input.html, text: input.text });
  } catch {
    // Notifications must never block business actions.
  }
}

function recurrenceText(value?: string) {
  if (!value || value === "NONE") {
    return "Aucune recurrence";
  }
  if (value === "DAILY") {
    return "Quotidienne";
  }
  if (value === "WEEKLY") {
    return "Hebdomadaire";
  }
  if (value === "MONTHLY") {
    return "Mensuelle";
  }
  return value;
}

function adminNotificationEmail() {
  return (
    process.env.ADMIN_NOTIFICATION_EMAIL ??
    process.env.ADMIN_EMAIL ??
    process.env.NOTIFICATION_EMAIL ??
    ""
  );
}

export async function notifyOrderReceived(payload: OrderNotificationPayload) {
  const subject = `Commande recue ${payload.orderId}`;
  const recurrence = recurrenceText(payload.recurrence);
  const text = [
    `Commande ${payload.orderId} recue.`,
    `Client: ${payload.clientCompany ?? "Client"}`,
    `Livraison: ${payload.deliveryDate}`,
    `Recurrence: ${recurrence}`,
    `Montant TTC: ${euro(payload.totalTtc)}`,
  ].join("\n");

  const html = `
    <p>Commande <strong>${payload.orderId}</strong> recue.</p>
    <p>Client: ${payload.clientCompany ?? "Client"}</p>
    <p>Livraison: ${payload.deliveryDate}</p>
    <p>Recurrence: ${recurrence}</p>
    <p>Montant TTC: <strong>${euro(payload.totalTtc)}</strong></p>
  `;

  await Promise.all([
    safeSendMail({
      to: payload.clientEmail,
      subject,
      text,
      html,
    }),
    safeSendMail({
      to: adminNotificationEmail(),
      subject: `[ADMIN] ${subject}`,
      text,
      html,
    }),
  ]);
}

export async function notifyOrderStatusChanged(payload: StatusNotificationPayload) {
  const subject = `Commande ${payload.orderId}: ${payload.status}`;
  const text = [
    `Mise a jour de la commande ${payload.orderId}.`,
    `Nouveau statut: ${payload.status}`,
    `Livraison: ${payload.deliveryDate}`,
    `Montant TTC: ${euro(payload.totalTtc)}`,
  ].join("\n");

  const html = `
    <p>Mise a jour de la commande <strong>${payload.orderId}</strong>.</p>
    <p>Nouveau statut: <strong>${payload.status}</strong></p>
    <p>Livraison: ${payload.deliveryDate}</p>
    <p>Montant TTC: ${euro(payload.totalTtc)}</p>
  `;

  await safeSendMail({
    to: payload.clientEmail,
    subject,
    text,
    html,
  });
}
