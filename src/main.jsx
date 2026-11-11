import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell, BriefcaseBusiness, CalendarDays, CarFront, Check, CircleCheck,
  Clock3, Lightbulb, ListTodo, Pencil, Plus, Search, Sparkles, Trash2, UserRound, X
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
async function apiRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
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

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [databaseHealth, setDatabaseHealth] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date');
  const [editing, setEditing] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
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
    function checkReminders() {
      const currentTime = Date.now();
      const dueTasks = tasks.filter(task => !task.done && task.due && !task.alerted && new Date(task.due).getTime() <= currentTime);
      if (!dueTasks.length) return;
      dueTasks.forEach(task => {
        addToast('A little nudge', `${task.title} is due now.`);
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification('Daybook reminder', { body: `${task.title} is due now.`, tag: `daybook-${task.id}` }); }
          catch { /* The in-app reminder has already been delivered. */ }
        }
      });
      const dueIds = new Set(dueTasks.map(task => task.id));
      dueIds.forEach(id => {
        apiRequest(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ alerted: true }) })
          .then(updated => setTasks(current => current.map(task => task.id === id ? updated : task)))
          .catch(error => setApiError(error.message));
      });
    }
    checkReminders();
    const timer = window.setInterval(checkReminders, 15000);
    return () => window.clearInterval(timer);
  }, [tasks]);

  function addToast(title, message) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(current => [...current, { id, title, message }]);
    window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 6000);
  }

  const labels = Object.fromEntries(categories.map(item => [item.filter, item.name]));
  const visibleTasks = tasks.filter(task => {
    if (activeFilter === 'done' && !task.done) return false;
    if (activeFilter !== 'done' && task.done) return false;
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
        if (done) addToast('Nicely done', task.title);
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

  async function enableNotifications() {
    if (!('Notification' in window)) {
      addToast('In-app reminders are ready', 'Keep this tab open to see due-task alerts.');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      addToast(result === 'granted' ? 'Reminders switched on' : 'In-app reminders are ready', result === 'granted' ? 'We will nudge you when a task is due.' : 'You can still get reminders while Daybook is open.');
    } catch {
      addToast('In-app reminders are ready', 'Keep this tab open to see due-task alerts.');
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
  const notificationCopy = permission === 'granted'
    ? 'You will get a nudge when a task is due.'
    : permission === 'denied'
      ? 'In-app reminders will still appear while Daybook is open.'
      : 'Get a little nudge when a task is due.';
  const notificationButton = permission === 'granted' ? 'Notifications are on' : permission === 'denied' ? 'Browser notifications blocked' : permission === 'unsupported' ? 'In-app reminders active' : 'Turn on notifications';

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
          <button className="enable-notifications" onClick={enableNotifications} disabled={permission === 'granted' || permission === 'denied' || permission === 'unsupported'}>{notificationButton}</button>
        </div>
        <div className="profile"><div className="avatar">ED</div><div className="profile-copy"><strong>Emmanuel Desmond</strong><span>Personal space</span></div></div>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="mobile-brand"><span className="brand-mark"><Check /></span>daybook</div>
        <div className="crumb">My space <span> / </span> <b>{labels[activeFilter]}</b></div>
        <div className="top-actions"><span className="date-chip">{dateLabel}</span><button className="icon-button" onClick={enableNotifications} aria-label="Notification settings" title="Notification settings"><Bell /></button></div>
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
          <div className="bottom-note"><span><CircleCheck />{loading ? 'Connecting to the database...' : apiError ? `Database unavailable: ${apiError}` : databaseHealth?.status === 'ok' ? `Connected to ${databaseHealth.database} · ${databaseHealth.engine}` : databaseHealth?.error ? `Database unavailable: ${databaseHealth.error}` : 'Checking database connection...'}</span><span>Just for you</span></div>
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
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);