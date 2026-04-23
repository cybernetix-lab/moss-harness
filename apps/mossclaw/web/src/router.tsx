import { createBrowserRouter } from 'react-router-dom';
import AppShell from './layouts/AppShell';
import DashboardPage from './pages/DashboardPage';
import SkillsPage from './pages/SkillsPage';
import TaskCreatePage from './pages/TaskCreatePage';
import TaskDetailPage from './pages/TaskDetailPage';
import TaskExecutionPage from './pages/TaskExecutionPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'tasks/new',
        element: <TaskCreatePage />,
      },
      {
        path: 'tasks/:id',
        element: <TaskDetailPage />,
      },
      {
        path: 'tasks/:id/run',
        element: <TaskExecutionPage />,
      },
      {
        path: 'skills',
        element: <SkillsPage />,
      },
    ],
  },
]);
