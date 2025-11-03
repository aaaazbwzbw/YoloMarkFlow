import { createRouter, createWebHashHistory } from 'vue-router'
import MainLayout from '../views/MainLayout.vue'
import StartupLoading from '../views/StartupLoading.vue'
import Welcome from '../views/Welcome.vue'
import Workbench from '../views/Workbench.vue'
import Training from '../views/Training.vue'
import Datasets from '../views/Datasets.vue'
import ModelHub from '../views/ModelHub.vue'
import Settings from '../views/Settings.vue'
import Help from '../views/Help.vue'

const routes = [
  {
    path: '/startup',
    name: 'StartupLoading',
    component: StartupLoading
  },
  {
    path: '/',
    component: MainLayout,
    redirect: '/welcome',
    children: [
      {
        path: '/welcome',
        name: 'Welcome',
        component: Welcome
      },
      {
        path: '/workbench',
        name: 'Workbench',
        component: Workbench
      },
      {
        path: '/training',
        name: 'Training',
        component: Training
      },
      {
        path: '/datasets',
        name: 'Datasets',
        component: Datasets
      },
      {
        path: '/modelhub',
        name: 'ModelHub',
        component: ModelHub
      },
      {
        path: '/settings',
        name: 'Settings',
        component: Settings
      },
      {
        path: '/help',
        name: 'Help',
        component: Help
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router

