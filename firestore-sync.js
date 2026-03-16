class FirestoreSync {
  constructor() {
    this.db = firebase.firestore();
    this.unsubscribers = [];
  }

  destroy() {
    this.unsubscribers.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[Sync] Falha ao encerrar listener:', error);
      }
    });
    this.unsubscribers = [];
  }

  subscribe(queryBuilder, callback, errorLabel = 'listener') {
    const unsubscribe = queryBuilder().onSnapshot(
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(items);
      },
      (error) => {
        console.error(`[Sync] Erro em ${errorLabel}:`, error);
      }
    );

    this.unsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  onCamerasChange(callback) {
    return this.subscribe(
      () => this.db.collection('cameras').orderBy('name', 'asc'),
      callback,
      'cameras'
    );
  }

  onActiveCamerasChange(callback) {
    return this.subscribe(
      () => this.db.collection('cameras').where('isActive', '==', true),
      callback,
      'active cameras'
    );
  }

  onMonitoringChange(callback) {
    return this.subscribe(
      () => this.db.collection('monitoring').orderBy('plate', 'asc'),
      callback,
      'monitoring'
    );
  }

  onActiveMonitoringChange(callback) {
    return this.subscribe(
      () => this.db.collection('monitoring').where('isActive', '==', true),
      callback,
      'active monitoring'
    );
  }

  // No firestore-sync.js, altere a função onEventsChange
onEventsChange(callback, limit = 1000) { // Reduzi para 1000 por segurança
  const safeLimit = Math.min(limit, 10000); 
  return this.subscribe(
    () => this.db.collection('events')
      .orderBy('captured_at', 'desc')
      .limit(safeLimit),
    callback,
    'events'
  );
}

  onAlertsChange(callback, limit = 50) {
    return this.subscribe(
      () => this.db.collection('alerts').orderBy('captured_at', 'desc').limit(limit),
      (items) => {
        const normalized = items.filter((item) => {
          if (typeof item.isRead !== 'undefined') return item.isRead === false;
          if (typeof item.is_read !== 'undefined') return item.is_read === false;
          return true;
        });
        callback(normalized);
      },
      'alerts'
    );
  }

  async markAlertAsRead(alertId) {
    const ref = this.db.collection('alerts').doc(alertId);
    await ref.set({
      isRead: true,
      is_read: true,
      read_at: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async saveUserPreferences(userId, data) {
    await this.db.collection('users').doc(userId).set({
      preferences: data,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async getDashboardCounters() {
    const [eventsSnap, alertsSnap, camerasSnap, monitoringSnap] = await Promise.all([
      this.db.collection('events').get(),
      this.db.collection('alerts').get(),
      this.db.collection('cameras').get(),
      this.db.collection('monitoring').get()
    ]);

    const alertsOpen = alertsSnap.docs.filter((doc) => {
      const data = doc.data();
      if (typeof data.isRead !== 'undefined') return data.isRead === false;
      if (typeof data.is_read !== 'undefined') return data.is_read === false;
      return true;
    }).length;

    return {
      events: eventsSnap.size,
      alerts: alertsOpen,
      cameras: camerasSnap.size,
      monitoring: monitoringSnap.size
    };
  }
}

window.firestoreSync = new FirestoreSync();
async function checkPermissions(user) {
  try {
    const doc = await window.db.collection('users').doc(user.uid).get();
    const userData = doc.data();

    if (!userData || !userData.allowed_menus) {
      console.error("Usuário sem perfil de acesso definido.");
      return;
    }

    const allowed = userData.allowed_menus; // Ex: ['dashboard', 'alerts']
    const navLinks = document.querySelectorAll('.nav a');
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
    
    // Converte 'index' para 'dashboard' para bater com o banco
    const currentKey = currentPage === 'index' ? 'dashboard' : currentPage;

    navLinks.forEach(link => {
      const href = link.getAttribute('href').replace('./', '').replace('.html', '');
      const menuKey = href === 'index' ? 'dashboard' : href;

      // 🔑 EXCEÇÃO CRÍTICA: Não esconde o botão de Sair nem links de ação
      if (href === '#' || link.innerText.toLowerCase().includes('sair')) {
        link.style.display = 'flex'; // Garante que o Sair esteja visível
        return;
      }

      // Se o menu não estiver na lista de permitidos, esconde o link
      if (!allowed.includes(menuKey) && menuKey !== 'login') {
        link.style.display = 'none';
      }
    });

    // Bloqueio de acesso direto via URL
    if (!allowed.includes(currentKey) && currentKey !== 'login') {
      alert("Acesso negado: Você não tem permissão para acessar este módulo.");
      window.location.href = './index.html';
    }

  } catch (error) {
    console.error("Erro ao validar permissões:", error);
  }
}

// Integração com o fluxo de autenticação existente
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    checkPermissions(user);
  }
});