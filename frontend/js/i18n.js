const DICT = {
  en: {
    tagline: 'Organize work. Ship faster.', login: 'Sign in', register: 'Create account', logout: 'Sign out',
    name: 'Full name', email: 'Email', password: 'Password', password_hint: 'At least 8 characters',
    menu: 'Menu', theme: 'Toggle theme', welcome: 'Welcome back, {name}',
    nav_dashboard: 'Dashboard', nav_tasks: 'Tasks', nav_board: 'Kanban Board', nav_projects: 'Projects', nav_profile: 'Profile',
    new_task: 'New task', edit_task: 'Edit task', new_project: 'New project', edit_project: 'Edit project',
    title: 'Title', description: 'Description', project: 'Project', no_project: 'No project', all_projects: 'All projects',
    status: 'Status', priority: 'Priority', due_date: 'Due date', color: 'Color',
    status_todo: 'To do', status_in_progress: 'In progress', status_review: 'In review', status_done: 'Done',
    priority_low: 'Low', priority_medium: 'Medium', priority_high: 'High',
    all_statuses: 'All statuses', all_priorities: 'All priorities', sort_newest: 'Newest', sort_due: 'Due date', sort_priority: 'Priority',
    search_placeholder: 'Search tasks…', save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit',
    confirm_delete_task: 'Delete this task? This cannot be undone.',
    confirm_delete_project: 'Delete this project and all of its tasks? This cannot be undone.',
    view_tasks: 'View tasks', move_to: 'Move to', mark_done: 'Toggle done',
    stat_total: 'Total tasks', stat_progress: 'In progress', stat_done: 'Completed', stat_overdue: 'Overdue',
    completion: 'Completion rate', by_status: 'Tasks by status', by_priority: 'Open tasks by priority',
    upcoming: 'Upcoming deadlines', due_week: 'due within 7 days', overdue_label: 'Overdue',
    empty_tasks: 'No tasks found', empty_projects: 'No projects yet', empty_upcoming: 'No upcoming deadlines',
    profile_info: 'Personal information', language: 'Language', theme_label: 'Theme', theme_light: 'Light', theme_dark: 'Dark',
    change_password: 'Change password', current_password: 'Current password', new_password: 'New password',
    saved: 'Saved', deleted: 'Deleted', password_changed: 'Password changed',
    err_generic: 'Something went wrong. Please try again.', err_network: 'Cannot reach the server.',
    err_invalid_credentials: 'Incorrect email or password.', err_email_taken: 'This email is already registered.',
    err_invalid_email: 'Enter a valid email address.', err_weak_password: 'Password must be at least 8 characters.',
    err_invalid_name: 'Enter a valid name.', err_invalid_title: 'Enter a title (up to 200 characters).',
    err_invalid_due_date: 'Invalid due date.', err_invalid_color: 'Invalid color.', err_invalid_project: 'Invalid project.',
    err_wrong_password: 'Current password is incorrect.', err_not_found: 'Item not found.', err_unauthorized: 'Please sign in again.',
  },
  ar: {
    tagline: 'نظّم عملك وأنجز أسرع', login: 'تسجيل الدخول', register: 'إنشاء حساب', logout: 'تسجيل الخروج',
    name: 'الاسم الكامل', email: 'البريد الإلكتروني', password: 'كلمة المرور', password_hint: '8 أحرف على الأقل',
    menu: 'القائمة', theme: 'تبديل الوضع', welcome: 'مرحباً بعودتك، {name}',
    nav_dashboard: 'لوحة التحكم', nav_tasks: 'المهام', nav_board: 'لوحة كانبان', nav_projects: 'المشاريع', nav_profile: 'الملف الشخصي',
    new_task: 'مهمة جديدة', edit_task: 'تعديل المهمة', new_project: 'مشروع جديد', edit_project: 'تعديل المشروع',
    title: 'العنوان', description: 'الوصف', project: 'المشروع', no_project: 'بدون مشروع', all_projects: 'كل المشاريع',
    status: 'الحالة', priority: 'الأولوية', due_date: 'تاريخ الإنجاز', color: 'اللون',
    status_todo: 'قيد الانتظار', status_in_progress: 'قيد التنفيذ', status_review: 'قيد المراجعة', status_done: 'مكتملة',
    priority_low: 'منخفضة', priority_medium: 'متوسطة', priority_high: 'عالية',
    all_statuses: 'كل الحالات', all_priorities: 'كل الأولويات', sort_newest: 'الأحدث', sort_due: 'تاريخ الإنجاز', sort_priority: 'الأولوية',
    search_placeholder: 'ابحث في المهام…', save: 'حفظ', cancel: 'إلغاء', delete: 'حذف', edit: 'تعديل',
    confirm_delete_task: 'حذف هذه المهمة؟ لا يمكن التراجع عن ذلك.',
    confirm_delete_project: 'حذف هذا المشروع وجميع مهامه؟ لا يمكن التراجع عن ذلك.',
    view_tasks: 'عرض المهام', move_to: 'نقل إلى', mark_done: 'تبديل الإنجاز',
    stat_total: 'إجمالي المهام', stat_progress: 'قيد التنفيذ', stat_done: 'مكتملة', stat_overdue: 'متأخرة',
    completion: 'نسبة الإنجاز', by_status: 'المهام حسب الحالة', by_priority: 'المهام المفتوحة حسب الأولوية',
    upcoming: 'المواعيد القادمة', due_week: 'تستحق خلال 7 أيام', overdue_label: 'متأخرة',
    empty_tasks: 'لا توجد مهام', empty_projects: 'لا توجد مشاريع بعد', empty_upcoming: 'لا توجد مواعيد قادمة',
    profile_info: 'المعلومات الشخصية', language: 'اللغة', theme_label: 'المظهر', theme_light: 'فاتح', theme_dark: 'داكن',
    change_password: 'تغيير كلمة المرور', current_password: 'كلمة المرور الحالية', new_password: 'كلمة المرور الجديدة',
    saved: 'تم الحفظ', deleted: 'تم الحذف', password_changed: 'تم تغيير كلمة المرور',
    err_generic: 'حدث خطأ ما. حاول مرة أخرى.', err_network: 'تعذّر الاتصال بالخادم.',
    err_invalid_credentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.', err_email_taken: 'هذا البريد مسجّل مسبقاً.',
    err_invalid_email: 'أدخل بريداً إلكترونياً صحيحاً.', err_weak_password: 'يجب ألا تقل كلمة المرور عن 8 أحرف.',
    err_invalid_name: 'أدخل اسماً صحيحاً.', err_invalid_title: 'أدخل عنواناً (حتى 200 حرف).',
    err_invalid_due_date: 'تاريخ الإنجاز غير صالح.', err_invalid_color: 'لون غير صالح.', err_invalid_project: 'مشروع غير صالح.',
    err_wrong_password: 'كلمة المرور الحالية غير صحيحة.', err_not_found: 'العنصر غير موجود.', err_unauthorized: 'يرجى تسجيل الدخول من جديد.',
  },
};

let lang = 'ar';

export const getLang = () => lang;

export function t(key, vars = {}) {
  const s = DICT[lang][key] ?? DICT.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export function errorMessage(err) {
  return DICT[lang]['err_' + err.code] ? t('err_' + err.code) : t('err_generic');
}

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const locale = lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
}

export function setLang(next) {
  lang = next === 'en' ? 'en' : 'ar';
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-action="toggle-lang"]').forEach((el) => { el.textContent = lang === 'ar' ? 'English' : 'العربية'; });
}
