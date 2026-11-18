import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, Bell, BriefcaseBusiness, CalendarDays, CarFront, Check, CircleCheck,
  Clock3, Eye, EyeOff, Lightbulb, ListTodo, LockKeyhole, LogOut, Mail, Pencil, Plus,
  Download, Search, Settings2, ShieldCheck, Sparkles, Trash2, UserRound, X
} from 'lucide-react';

const categories = [
  { name: 'Today', icon: CalendarDays, filter: 'all' },
  { name: 'Work', icon: BriefcaseBusiness, filter: 'Work' },
  { name: 'Personal', icon: UserRound, filter: 'Personal' },
  { name: 'Errands', icon: CarFront, filter: 'Errands' },
  { name: 'Ideas', icon: Lightbulb, filter: 'Ideas' },
  { name: 'Completed', icon: CircleCheck, filter: 'done' }
];
const priorityRank = { high: 0, medium: 1, low: 2 };
const apiBaseUrl = import.meta.env.DEV ? (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '') : '';
async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'The server could not complete the request.');
  }
  return response.status === 204 ? null : response.json();
}

function formatDue(value) {
  if (!value) return { main: 'No date', sub: '' };
  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const main = date.toDateString() === today.toDateString()
    ? 'Today'
    : date.toDateString() === tomorrow.toDateString()
      ? 'Tomorrow'
      : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  return { main, sub: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date) };
}

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function LoginPage({ onAuthenticated }) {
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('login');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  async function submitLogin(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const credentials = { email: form.get('email'), password: form.get('password') };
    if (mode === 'login') credentials.remember = form.get('remember') === 'on';
    try {
      const result = await apiRequest(`/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      onAuthenticated(result.user);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="login-page">
    <section className="login-visual" aria-label="A calm, organized workspace">
      <div className="visual-photo" />
      <div className="visual-shade" />
      <div className="visual-topline"><span className="login-brand"><span className="login-brand-mark"><Check /></span>daybook</span><span className="visual-edition">YOUR SPACE, IN GOOD ORDER</span></div>
      <div className="visual-copy"><span className="visual-kicker"><Sparkles /> A LITTLE MORE CLARITY</span><h1>Make room<br />for what matters.</h1><p>A calmer way to move through your day, one thoughtful step at a time.</p></div>
      <div className="preview-note"><div className="preview-note-top"><span className="preview-check"><Check /></span><span>Today is taking shape</span><span className="preview-count">03 / 05</span></div><div className="preview-progress"><span /></div><div className="preview-task"><span className="preview-dot" />Review the big picture <small>9:30 AM</small></div><div className="preview-task"><span className="preview-dot coral" />Make time for a proper break <small>12:15 PM</small></div></div>
      <div className="visual-footer"><span><ShieldCheck /> A quiet place for your plans</span><span>EST. FOR YOUR EVERY DAY</span></div>
    </section>
    <section className="login-panel">
      <div className="login-panel-inner">
        <div className="mobile-login-brand"><span className="login-brand-mark"><Check /></span>daybook</div>
        <div className="login-heading"><span className="login-overline">{mode === 'login' ? 'WELCOME BACK' : 'A FRESH START'}</span><h2>{mode === 'login' ? 'Your day, waiting.' : 'Make it yours.'}</h2><p>{mode === 'login' ? 'Sign in to pick up right where you left off.' : 'Create an account to keep your plans in one place.'}</p></div>
        <form className="login-form" onSubmit={submitLogin}>
          <label className="login-label" htmlFor="login-email">Email address</label>
          <div className="login-input-wrap"><Mail /><input id="login-email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></div>
          <div className="password-label-row"><label className="login-label" htmlFor="login-password">Password</label>{mode === 'login' && <button className="text-action" type="button" onClick={() => setMessage('Password reset is not available yet. Contact support if you need help accessing your account.')}>Forgot password?</button>}</div>
          <div className="login-input-wrap"><LockKeyhole /><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} placeholder={mode === 'login' ? 'Enter your password' : 'At least 10 characters'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 10 : undefined} maxLength={128} required /><button className="password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button></div>
          {mode === 'login' && <label className="remember-row"><input type="checkbox" name="remember" /><span className="remember-box"><Check /></span><span>Keep me signed in</span></label>}
          <button className="login-submit" type="submit" disabled={submitting}><span>{submitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}</span><ArrowRight /></button>
          <p className="login-message" role="status" aria-live="polite">{message}</p>
        </form>
        <p className="signup-prompt">{mode === 'login' ? 'New to Daybook?' : 'Already have an account?'} <button className="text-action signup-action" type="button" onClick={() => { setMode(value => value === 'login' ? 'register' : 'login'); setMessage(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
        <div className="login-security"><ShieldCheck /><span>Your plans are personal. Your space stays yours.</span></div>
      </div>
      <footer className="login-legal"><span>© 2026 Daybook</span><a href="mailto:hello@daybook.example">Need a hand?</a></footer>
    </section>
  </main>;
}

function App({ user, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [databaseHealth, setDatabaseHealth] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date');
  const [editing, setEditing] = useState(null);
  const [mobilePanel, setMobilePanel] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
  const preferenceKey = `daybook-notifications:${user.id}`;
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = window.localStorage.getItem(`${preferenceKey}:browser`);
    return saved === null ? ('Notification' in window && Notification.permission === 'granted') : saved === 'true';
  });
  const [emailNotify, setEmailNotify] = useState(() => window.localStorage.getItem(`${preferenceKey}:email`) === 'true');
  const processingReminders = useRef(new Set());
  const [removing, setRemoving] = useState([]);
  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now);
  const incomplete = tasks.filter(task => !task.done);
  const completed = tasks.filter(task => task.done);
  const dueToday = incomplete.filter(task => task.due && new Date(task.due).toDateString() === new Date().toDateString());

  async function refreshTasks() {
    setLoading(true);
    try {
      setTasks(await apiRequest('/tasks'));
      setApiError('');
    } catch (error) {
      setApiError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshTasks();
    apiRequest('/health')
      .then(setDatabaseHealth)
      .catch(error => setDatabaseHealth({ status: 'error', error: error.message }));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(`${preferenceKey}:browser`, String(notificationsEnabled));
  }, [preferenceKey, notificationsEnabled]);

  useEffect(() => {
    window.localStorage.setItem(`${preferenceKey}:email`, String(emailNotify));
  }, [preferenceKey, emailNotify]);

  useEffect(() => {
    function handleInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }
    function handleInstalled() {
      setIsInstalled(true);
      setInstallPrompt(null);
      addToast('Daybook installed', 'You can open it from your home screen.');
    }
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    async function checkReminders() {
      const currentTime = Date.now();
      const dueTasks = tasks.filter(task => !task.done && task.due && !task.alerted && !processingReminders.current.has(task.id) && new Date(task.due).getTime() <= currentTime);
      if (!dueTasks.length) return;
      await Promise.all(dueTasks.map(async task => {
        processingReminders.current.add(task.id);
        addToast('A little nudge', `${task.title} is due now.`);
        if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
          try {
            const registration = await navigator.serviceWorker?.getRegistration();
            if (registration) {
              await registration.showNotification('Daybook reminder', {
                body: `${task.title} is due now.`,
                icon: '/daybook-icon.svg',
                tag: `daybook-${task.id}`,
                data: { url: '/' }
              });
            } else {
              new Notification('Daybook reminder', { body: `${task.title} is due now.`, tag: `daybook-${task.id}` });
            }
          } catch {
            addToast('Device notification unavailable', 'Keep Daybook open to see in-app reminders.');
          }
        }
        if (emailNotify) {
          try {
            await apiRequest('/notify/email', {
              method: 'POST',
              body: JSON.stringify({
                subject: 'Task reminder',
                text: `${task.title} is due now.`
              })
            });
          } catch (e) {
            addToast('Email reminder failed', e.message);
          }
        }
        try {
          const updated = await apiRequest(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ alerted: true }) });
          setTasks(current => current.map(item => item.id === task.id ? updated : item));
        } catch (error) {
          processingReminders.current.delete(task.id);
          setApiError(error.message);
        }
      }));
    }
    checkReminders();
    const timer = window.setInterval(checkReminders, 5000);
    const handleVisibility = () => { if (!document.hidden) checkReminders(); };
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [tasks, emailNotify, notificationsEnabled]);

  function addToast(title, message) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(current => [...current, { id, title, message }]);
    window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 6000);
  }

  const labels = Object.fromEntries(categories.map(item => [item.filter, item.name]));
  const visibleTasks = tasks.filter(task => {
    if (activeFilter === 'done' && !task.done) return false;
    if (categories.some(item => item.filter === activeFilter && item.name !== 'Today') && task.category !== activeFilter) return false;
    return task.title.toLowerCase().includes(search.trim().toLowerCase());
  }).sort((a, b) => {
    if (sort === 'priority') return priorityRank[a.priority] - priorityRank[b.priority];
    if (sort === 'created') return (b.created || '').localeCompare(a.created || '');
    return (a.due || '9999').localeCompare(b.due || '9999');
  });

  function toggleTask(task) {
    const done = !task.done;
    const alerted = task.done && task.due && new Date(task.due) <= new Date() ? false : task.alerted;
    apiRequest(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ done, alerted }) })
      .then(updated => {
        setTasks(current => current.map(item => item.id === task.id ? updated : item));
        if (done) addToast('Task completed', task.title);
        setApiError('');
      })
      .catch(error => { setApiError(error.message); addToast('Task not updated', error.message); });
  }

  function deleteTask(id) {
    setRemoving(current => [...current, id]);
    window.setTimeout(() => {
      apiRequest(`/tasks/${id}`, { method: 'DELETE' })
        .then(() => { setTasks(current => current.filter(task => task.id !== id)); setApiError(''); })
        .catch(error => { setApiError(error.message); addToast('Task not deleted', error.message); })
        .finally(() => setRemoving(current => current.filter(item => item !== id)));
    }, 220);
  }

  async function toggleNotifications() {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      addToast('Device notifications turned off', 'In-app reminders will still appear while Daybook is open.');
      return;
    }
    if (!('Notification' in window)) {
      setNotificationsEnabled(true);
      addToast('In-app reminders are on', 'This browser does not support device notifications.');
      return;
    }
    try {
      const result = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      setPermission(result);
      if (result === 'granted') {
        setNotificationsEnabled(true);
        addToast('Device notifications turned on', 'You will be notified when a task is due.');
      } else {
        setNotificationsEnabled(false);
        addToast('Notifications are blocked', 'Allow notifications for Daybook in your browser or phone settings.');
      }
    } catch {
      addToast('Could not enable notifications', 'Check your browser permission settings and try again.');
    }
  }

  async function toggleEmailNotifications() {
    if (emailNotify) {
      setEmailNotify(false);
      addToast('Email reminders turned off', 'You will no longer receive task reminder emails.');
      return;
    }
    try {
      await apiRequest('/notify/email', {
        method: 'POST',
        body: JSON.stringify({
          subject: 'Daybook notifications enabled',
          text: 'You will now receive reminders by email when a task is due.'
        })
      });
      setEmailNotify(true);
      addToast('Email reminders turned on', `A confirmation was sent to ${user.email}.`);
    } catch (error) {
      addToast('Email reminders could not be enabled', error.message);
    }
  }

  async function installApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setIsInstalled(true);
      setInstallPrompt(null);
      return;
    }
    const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    addToast(
      isAppleMobile ? 'Add Daybook to your Home Screen' : 'Install Daybook from your browser',
      isAppleMobile ? 'In Safari, tap Share, then Add to Home Screen.' : 'Open your browser menu and choose Install app or Add to Home Screen.'
    );
  }

  async function logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      onLogout();
    }
  }

  async function saveTask(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dueValue = form.get('due');
    const details = {
      title: String(form.get('title')).trim(),
      category: form.get('category'),
      priority: form.get('priority'),
      due: dueValue ? new Date(dueValue).toISOString() : ''
    };
    try {
      const task = editing.id
        ? await apiRequest(`/tasks/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ ...details, alerted: false }) })
        : await apiRequest('/tasks', { method: 'POST', body: JSON.stringify(details) });
      setTasks(current => editing.id
        ? current.map(item => item.id === editing.id ? task : item)
        : [task, ...current]);
      setApiError('');
      addToast(editing.id ? 'Task updated' : 'Added to your day', details.title);
      setEditing(null);
    } catch (error) {
      setApiError(error.message);
      addToast('Task not saved', error.message);
    }
  }

  function openEditor(task = null) {
    setEditing(task || {});
  }

  const greeting = now.getHours() < 12 ? 'A clearer day starts here.' : now.getHours() < 17 ? 'Make today count, gently.' : 'You made it through today.';
  const focusTitle = incomplete.length === 0 ? 'All clear. Take a breath.' : incomplete.length === 1 ? 'One thing at a time.' : 'Small steps add up.';
  const focusSubtitle = incomplete.length === 0 ? 'You made room for what matters today.' : `${incomplete.length} ${incomplete.length === 1 ? 'task' : 'tasks'} waiting, and you're right on track.`;
  let notificationCopy = permission === 'denied'
    ? 'Notifications are blocked in browser settings.'
    : notificationsEnabled
      ? 'Device notifications are on for due tasks.'
      : 'Turn on device notifications for due tasks.';
  if (emailNotify) notificationCopy += ' Email reminders are ON.';

  return <div className="app-shell">
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand"><span className="brand-mark"><Check /></span>daybook</div>
      <p className="nav-label">Your space</p>
      <nav className="nav-list">
        {categories.map(({ name, icon: Icon, filter }) => <button key={filter} className={`nav-item ${activeFilter === filter ? 'active' : ''}`} onClick={() => setActiveFilter(filter)}>
          <Icon /><span className="nav-name">{name}</span><span className="nav-count">{filter === 'all' ? incomplete.length : filter === 'done' ? completed.length : incomplete.filter(task => task.category === name).length}</span>
        </button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="notification-card">
          <div className="notification-head"><strong>Gentle reminders</strong><Bell /></div>
          <p>{notificationCopy}</p>
          <button className="enable-notifications" role="switch" aria-checked={notificationsEnabled} onClick={toggleNotifications}>{notificationsEnabled ? 'Turn off device notifications' : permission === 'denied' ? 'Allow in browser settings' : 'Turn on device notifications'}</button>
          <button className="enable-notifications" style={{ marginTop: 8 }} role="switch" aria-checked={emailNotify} onClick={toggleEmailNotifications}>
            {emailNotify ? 'Turn off email reminders' : 'Turn on email reminders'}
          </button>
        </div>
        <div className="profile"><div className="avatar">{user.email.slice(0, 2).toUpperCase()}</div><div className="profile-copy"><strong>{user.email}</strong><span>Personal space</span></div><button className="row-button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut /></button></div>
      </div>
    </aside>
    <nav className="mobile-dock" aria-label="Mobile navigation">
      <button className={`dock-item ${activeFilter === 'all' && !mobilePanel ? 'active' : ''}`} onClick={() => { setActiveFilter('all'); setMobilePanel(null); }} aria-current={activeFilter === 'all' && !mobilePanel ? 'page' : undefined}>
        <CalendarDays /><span>Today</span>
      </button>
      <button className={`dock-item ${mobilePanel === 'lists' || (activeFilter !== 'all' && !mobilePanel) ? 'active' : ''}`} onClick={() => setMobilePanel(value => value === 'lists' ? null : 'lists')} aria-expanded={mobilePanel === 'lists'}>
        <ListTodo /><span>Lists</span>
      </button>
      <button className={`dock-item ${mobilePanel === 'settings' ? 'active' : ''}`} onClick={() => setMobilePanel(value => value === 'settings' ? null : 'settings')} aria-expanded={mobilePanel === 'settings'}>
        <Settings2 /><span>Settings</span>
      </button>
      <button className={`dock-item ${mobilePanel === 'profile' ? 'active' : ''}`} onClick={() => setMobilePanel(value => value === 'profile' ? null : 'profile')} aria-label="Profile" aria-expanded={mobilePanel === 'profile'}>
        <span className="dock-avatar">{user.email.slice(0, 2).toUpperCase()}</span><span>Profile</span>
      </button>
    </nav>
    <main className="main">
      <header className="topbar">
        <div className="mobile-brand"><span className="brand-mark"><Check /></span>daybook</div>
        <div className="crumb">My space <span> / </span> <b>{labels[activeFilter]}</b></div>
        <div className="top-actions"><span className="date-chip">{dateLabel}</span>{!isInstalled && <button className="add-button" onClick={installApp} title="Install Daybook"><Download /><span>Install</span></button>}<button className="icon-button" onClick={toggleNotifications} aria-label="Toggle notifications" title="Toggle notifications" aria-pressed={notificationsEnabled}><Bell /></button></div>
      </header>
      <div className="content">
        <section className="welcome"><div><div className="eyebrow">{dateLabel} · YOUR DAILY EDITION</div><h1>{greeting}</h1><p>Make a little progress on what matters to you.</p></div><button className="add-button" onClick={() => openEditor()}><Plus /><span>New task</span></button></section>
        <section className="overview" aria-label="Task overview">
          <div className="focus-card"><div className="focus-copy"><span>Your day, at a glance</span><strong>{focusTitle}</strong><p>{focusSubtitle}</p></div><div className="focus-icon"><Sparkles /></div></div>
          <div className="stat-card"><div className="stat-top">To do <ListTodo /></div><div className="stat-value">{incomplete.length}</div><div className="stat-foot">on your list</div></div>
          <div className="stat-card"><div className="stat-top">Completed <CircleCheck /></div><div className="stat-value">{completed.length}</div><div className="stat-foot">you've got this</div></div>
          <div className="stat-card"><div className="stat-top">Due today <Clock3 /></div><div className="stat-value">{dueToday.length}</div><div className="stat-foot">a few timely nudges</div></div>
        </section>
        <section>
          <div className="section-heading"><h2>{activeFilter === 'all' ? 'Your tasks' : labels[activeFilter]} <span>{visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'}</span></h2><div className="list-actions"><label className="search-box"><Search /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a task..." aria-label="Find a task" /></label><select className="sort-select" value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort tasks"><option value="date">Due date</option><option value="priority">Priority</option><option value="created">Recently added</option></select></div></div>
          {visibleTasks.length ? <div className="task-list">{visibleTasks.map(task => {
            const due = formatDue(task.due);
            const overdue = task.due && new Date(task.due) < new Date() && !task.done;
            return <article key={task.id} className={`task-row ${task.done ? 'done' : ''} ${removing.includes(task.id) ? 'removing' : ''}`}>
              <div className="task-title-wrap"><button className="check" onClick={() => toggleTask(task)} aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}><Check /></button><span className="task-title" title={task.title}>{task.title}</span></div>
              <span className="task-category">{task.category}</span><span className={`priority ${task.priority}`}>{task.priority}</span>
              <div className={`task-due ${overdue ? 'overdue' : ''}`}>{due.main}<small>{due.sub || (overdue ? 'Past due' : '')}</small></div>
              <div className="row-end"><button className="row-button" onClick={() => openEditor(task)} aria-label={`Edit ${task.title}`} title="Edit task"><Pencil /></button><button className="row-button delete" onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`} title="Delete task"><Trash2 /></button></div>
            </article>;
          })}</div> : <div className="empty-state" style={{ display: 'block' }}><CircleCheck /><strong>{loading ? 'Loading your tasks' : apiError ? 'Your tasks could not be reached' : 'Nothing on this list just yet'}</strong><p>{loading ? 'Connecting to your Daybook database.' : apiError ? apiError : "A little breathing room. Add a task whenever you're ready."}</p>{apiError && <button className="secondary-button" type="button" onClick={refreshTasks}>Try again</button>}</div>}
        </section>
      </div>
    </main>
    <div className="toast-region" aria-live="polite">{toasts.map(toast => <div className="toast" key={toast.id}><span className="toast-icon"><Bell /></span><span className="toast-copy"><strong>{toast.title}</strong><span>{toast.message}</span></span><button className="toast-close" onClick={() => setToasts(current => current.filter(item => item.id !== toast.id))} aria-label="Dismiss"><X /></button></div>)}</div>
    {editing !== null && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}><section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="modal-head"><h2 id="dialog-title">{editing.id ? 'Tend to your task' : 'Make a little plan'}</h2><button className="row-button" onClick={() => setEditing(null)} aria-label="Close"><X /></button></div>
      <form className="modal-form" onSubmit={saveTask}>
        <div className="field"><label htmlFor="task-name">WHAT'S ON YOUR MIND?</label><input id="task-name" name="title" maxLength="90" placeholder="e.g. Send the project notes" defaultValue={editing.title || ''} required autoFocus /></div>
        <div className="form-grid"><div className="field"><label htmlFor="task-category">CATEGORY</label><select id="task-category" name="category" defaultValue={editing.category || (categories.some(item => item.filter === activeFilter && item.name !== 'Today') ? activeFilter : 'Work')}><option>Work</option><option>Personal</option><option>Errands</option><option>Ideas</option></select></div><div className="field"><label htmlFor="task-priority">PRIORITY</label><select id="task-priority" name="priority" defaultValue={editing.priority || 'medium'}><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select></div></div>
        <div className="field"><label htmlFor="task-due">REMIND ME AT</label><input id="task-due" name="due" type="datetime-local" defaultValue={toLocalInput(editing.due)} /></div>
        <div className="modal-footer"><button className="secondary-button" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="submit-button" type="submit">{editing.id ? 'Save changes' : 'Add to my day'}</button></div>
      </form>
    </section></div>}
    {mobilePanel && <div className="mobile-sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setMobilePanel(null); }}>
      <section className="mobile-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-sheet-title">
        <div className="mobile-sheet-grip" />
        <div className="mobile-sheet-heading"><h2 id="mobile-sheet-title">{mobilePanel === 'lists' ? 'Your lists' : mobilePanel === 'settings' ? 'Settings' : 'Your profile'}</h2><button className="row-button" onClick={() => setMobilePanel(null)} aria-label="Close panel"><X /></button></div>
        {mobilePanel === 'lists' && <div className="mobile-list-options">{categories.map(({ name, icon: Icon, filter }) => {
          const count = filter === 'all' ? incomplete.length : filter === 'done' ? completed.length : incomplete.filter(task => task.category === name).length;
          return <button key={filter} className={`mobile-list-option ${activeFilter === filter ? 'selected' : ''}`} onClick={() => { setActiveFilter(filter); setMobilePanel(null); }}><span className="mobile-list-icon"><Icon /></span><span className="mobile-list-name">{name}</span><span className="mobile-list-count">{count}</span></button>;
        })}</div>}
        {mobilePanel === 'settings' && <div className="mobile-panel-content">
          <div className="mobile-setting-row"><span className="mobile-setting-icon"><Bell /></span><span className="mobile-setting-copy"><strong>Gentle reminders</strong><small>{notificationCopy}</small></span></div>
          <button className="enable-notifications" role="switch" aria-checked={notificationsEnabled} onClick={toggleNotifications}>{notificationsEnabled ? 'Turn off device notifications' : permission === 'denied' ? 'Allow in browser settings' : 'Turn on device notifications'}</button>
          <button className="enable-notifications" style={{ marginTop: 8 }} role="switch" aria-checked={emailNotify} onClick={toggleEmailNotifications}>{emailNotify ? 'Turn off email reminders' : 'Turn on email reminders'}</button>
          <p className="mobile-panel-note">Device reminders need browser permission. For task alerts, keep Daybook open or running in the background.</p>
        </div>}
        {mobilePanel === 'profile' && <div className="mobile-panel-content"><div className="mobile-profile-summary"><div className="mobile-profile-avatar">{user.email.slice(0, 2).toUpperCase()}</div><div><strong>{user.email}</strong><span>Personal space</span></div></div><button className="mobile-signout" onClick={logout}><LogOut /><span>Sign out</span></button></div>}
      </section>
    </div>}
  </div>;
}

function AuthGate() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    apiRequest('/auth/session')
      .then(result => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) return <div className="auth-loading" aria-label="Checking your session"><span /></div>;
  return user ? <App user={user} onLogout={() => setUser(null)} /> : <LoginPage onAuthenticated={setUser} />;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><AuthGate /></React.StrictMode>);