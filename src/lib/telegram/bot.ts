// Telegram Bot Integration for QUÂN SƯ ADS
// Gửi alerts về campaign performance

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export interface AlertData {
    type: 'critical' | 'warning' | 'insight';
    title: string;
    campaignName: string;
    metrics: {
        current: number;
        previous: number;
        change: number; // percentage
        unit: string; // 'đ', '%', ''
    };
    reason?: string;
    suggestion?: string;
    campaignId?: string;
}

/**
 * Format alert message for Telegram
 */
function formatAlertMessage(alert: AlertData): string {
    const emoji = {
        critical: '🔴 CRITICAL',
        warning: '🟡 WARNING',
        insight: '🟢 INSIGHT'
    };

    const changeSymbol = alert.metrics.change > 0 ? '+' : '';
    const changeText = `${changeSymbol}${alert.metrics.change.toFixed(0)}%`;

    let message = `${emoji[alert.type]}: ${alert.title}\n\n`;
    message += `📊 *${alert.campaignName}*\n`;
    message += `${formatValue(alert.metrics.previous, alert.metrics.unit)} → ${formatValue(alert.metrics.current, alert.metrics.unit)} (${changeText})\n`;

    if (alert.reason) {
        message += `\n💡 *Nguyên nhân:* ${alert.reason}`;
    }
    if (alert.suggestion) {
        message += `\n✅ *Đề xuất:* ${alert.suggestion}`;
    }

    return message;
}

function formatValue(value: number, unit: string): string {
    if (unit === 'đ') {
        return `${value.toLocaleString('vi-VN')}đ`;
    }
    if (unit === '%') {
        return `${value.toFixed(2)}%`;
    }
    return value.toLocaleString('vi-VN');
}

/**
 * Send alert to Telegram
 */
export async function sendTelegramAlert(alert: AlertData): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error('Telegram credentials not configured');
        return false;
    }

    const message = formatAlertMessage(alert);

    // Create inline keyboard for actions
    const keyboard = {
        inline_keyboard: [
            [
                { text: '⏸️ Tạm dừng', callback_data: `pause_${alert.campaignId}` },
                { text: '📊 Chi tiết', url: `https://ads.supbaongu.vn/dashboard?campaign=${alert.campaignId}` }
            ],
            [
                { text: '✅ Đã xử lý', callback_data: `dismiss_${alert.campaignId}` }
            ]
        ]
    };

    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
                reply_markup: alert.campaignId ? keyboard : undefined
            })
        });

        const result = await response.json();
        return result.ok;
    } catch (error) {
        console.error('Failed to send Telegram alert:', error);
        return false;
    }
}

/**
 * Send simple text message
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        return false;
    }

    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: text,
                parse_mode: 'Markdown'
            })
        });

        const result = await response.json();
        return result.ok;
    } catch (error) {
        console.error('Failed to send Telegram message:', error);
        return false;
    }
}

/**
 * Send daily summary
 */
export async function sendDailySummary(data: {
    totalSpend: number;
    totalRevenue: number;
    totalLeads: number;
    topCampaign: string;
    worstCampaign: string;
    alerts: number;
}): Promise<boolean> {
    const roas = data.totalSpend > 0 ? (data.totalRevenue / data.totalSpend).toFixed(2) : '0';

    const message = `📈 *BÁO CÁO NGÀY ${new Date().toLocaleDateString('vi-VN')}*

💰 Chi tiêu: ${data.totalSpend.toLocaleString('vi-VN')}đ
💵 Doanh thu: ${data.totalRevenue.toLocaleString('vi-VN')}đ
📊 ROAS: ${roas}x
👥 Leads: ${data.totalLeads}

🏆 *Top performer:* ${data.topCampaign}
⚠️ *Cần chú ý:* ${data.worstCampaign}

🔔 ${data.alerts} cảnh báo trong ngày`;

    return sendTelegramMessage(message);
}
