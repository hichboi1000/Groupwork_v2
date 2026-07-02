import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const res = await axios.post('http://localhost:8000/api/token/refresh/', { refresh });
          localStorage.setItem('access_token', res.data.access);
          original.headers.Authorization = `Bearer ${res.data.access}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const login = (credentials) => axios.post('http://localhost:8000/api/token/', credentials);
export const register = (data) => api.post('/register/', data);
export const getMe = () => api.get('/me/');
export const getDashboardStats = () => api.get('/dashboard/');

// Classes (rep-managed cohorts)
export const getClasses = () => api.get('/classes/');
export const createClass = (data) => api.post('/classes/', data);
export const getClass = (id) => api.get(`/classes/${id}/`);
export const updateClass = (id, data) => api.patch(`/classes/${id}/`, data);
export const deleteClass = (id) => api.delete(`/classes/${id}/`);
export const addRepToClass = (id, userId) => api.post(`/classes/${id}/add-rep/`, { user_id: userId });

export const createGroup = (data) => api.post('/groups/create/', data);
export const joinGroup = (data) => api.post('/groups/join/', data);
export const getMyGroup = () => api.get('/groups/mine/');
export const getAllGroups = () => api.get('/groups/all/');
export const leaveGroup = () => api.delete('/groups/leave/');
export const getGroupProgress = (groupId) => api.get('/groups/progress/', { params: groupId ? { group_id: groupId } : {} });
export const getTasks = (params) => api.get('/tasks/', { params });
export const getTask = (id) => api.get(`/tasks/${id}/`);
export const createTask = (data) => api.post('/tasks/', data);
export const updateTask = (id, data) => {
  // If a file is included, send multipart; otherwise plain JSON works fine.
  if (data.submission_file instanceof File) {
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null) form.append(k, v); });
    return api.patch(`/tasks/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
  return api.patch(`/tasks/${id}/`, data);
};
export const deleteTask = (id) => api.delete(`/tasks/${id}/`);

// Units — getUnits() is scoped server-side by role automatically
export const getUnits = () => api.get('/units/');
export const createUnit = (data) => api.post('/units/create/', data);
export const getMyUnits = () => api.get('/units/mine/');

// Unit Offerings (attach/detach — rep controlled)
export const getUnitOfferings = () => api.get('/unit-offerings/');
export const getUnitOfferingsHistory = () => api.get('/unit-offerings/history/');
export const attachClassToUnit = (data) => api.post('/unit-offerings/attach/', data);
export const detachClass = (offeringId, confirm = false) =>
  api.post(`/unit-offerings/${offeringId}/detach/`, { confirm });

export const getAssignments = () => api.get('/assignments/');
export const getAssignment = (id) => api.get(`/assignments/${id}/`);
export const createAssignment = (data) => api.post('/assignments/', data);
export const updateAssignment = (id, data) => api.patch(`/assignments/${id}/`, data);
export const deleteAssignment = (id) => api.delete(`/assignments/${id}/`);
export const getGroupAssignments = () => api.get('/group-assignments/');
export const createGroupAssignment = (data) => api.post('/group-assignments/', data);
export const getSubmissions = () => api.get('/submissions/');
export const createSubmission = (data) => {
  const form = new FormData();
  Object.entries(data).forEach(([k, v]) => { if (v !== undefined) form.append(k, v); });
  return api.post('/submissions/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const getNotifications = () => api.get('/notifications/');
export const markRead = (id) => api.patch(`/notifications/${id}/read/`);
export const markAllRead = () => api.post('/notifications/read-all/');
export const getUsers = () => api.get('/users/');

export default api;
