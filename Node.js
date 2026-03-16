const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.onNewAlertPush = functions.firestore
  .document('alerts/{alertId}')
  .onCreate(async (snap, context) => {
    const alertData = snap.data();
    const plate = alertData.plate;
    const camera = alertData.camera_name || "Câmera não identificada";

    // 1. Busca todos os usuários ativos com permissão de 'alerts'
    const usersSnap = await admin.firestore().collection('users')
      .where('is_active', '==', true)
      .where('allowed_menus', 'array-contains', 'alerts')
      .get();

    const tokens = [];
    usersSnap.forEach(doc => {
      const data = doc.data();
      if (data.fcm_tokens) tokens.push(...data.fcm_tokens);
    });

    if (tokens.length === 0) return null;

    // 2. Constrói o payload da notificação
    const payload = {
      notification: {
        title: `🚨 ALERTA LPR: ${plate}`,
        body: `Veículo identificado na ${camera}. Clique para agir.`,
        icon: 'https://seu-dominio.com/icon-192.png',
        click_action: 'https://seu-dominio.com/alerts.html'
      },
      data: {
        alertId: context.params.alertId,
        url: './alerts.html'
      }
    };

    // 3. Envia para todos os dispositivos
    return admin.messaging().sendToDevice(tokens, payload);
  });