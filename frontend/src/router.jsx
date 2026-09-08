import { createBrowserRouter, createRoutesFromElements, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import Layout from './components/Layout';
import DemoLayout from './components/DemoLayout';
import LandingLayout from './components/landing/LandingLayout';
import ErrorBoundary from './components/ErrorBoundary';
import lazyRoute from './lib/lazyRoute';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import IndexRedirect from './pages/IndexRedirect';
import HomeLayout from './components/HomeLayout';
import HomeSkeleton from './components/skeletons/HomeSkeleton';
import ApprentissageSkeleton from './components/skeletons/ApprentissageSkeleton';
import AboutSkeleton from './components/skeletons/AboutSkeleton';
import TodosSkeleton from './components/skeletons/TodosSkeleton';
import RoutinesSkeleton from './components/skeletons/RoutinesSkeleton';
import DomainesSkeleton from './components/skeletons/DomainesSkeleton';
import CarteMentaleSkeleton from './components/skeletons/CarteMentaleSkeleton';
import NotesSkeleton from './components/skeletons/NotesSkeleton';
import DebatSkeleton from './components/skeletons/DebatSkeleton';
import MarkdownSkeleton from './components/skeletons/MarkdownSkeleton';
import PricingSkeleton from './components/skeletons/PricingSkeleton';
import SettingsSkeleton from './components/skeletons/SettingsSkeleton';
import { aboutLoader } from './loaders/about';
import { apprentissageLoader } from './loaders/apprentissage';
import { homeLoader } from './loaders/home';
import { domainesLoader } from './loaders/domaines';
import { carteMentaleLoader } from './loaders/carte-mentale';
import { notesLoader } from './loaders/notes';
import { debatLoader } from './loaders/debat';
import {
  markdownHomeLoader,
  markdownDomainLoader,
  markdownChapterLoader,
} from './loaders/markdown';
import { indexRedirectLoader } from './loaders/indexRedirect';
import { onboardingLoader } from './loaders/onboarding';
import { demoHomeLoader } from './loaders/demo/home';
import { demoApprentissageLoader } from './loaders/demo/apprentissage';
import { demoDomainesLoader } from './loaders/demo/domaines';
import {
  demoMarkdownHomeLoader,
  demoMarkdownDomainLoader,
  demoMarkdownChapterLoader,
} from './loaders/demo/markdown';
import { demoCarteMentaleLoader } from './loaders/demo/carte-mentale';
import { demoNotesLoader } from './loaders/demo/notes';
import { demoDebatLoader } from './loaders/demo/debat';

const Home = lazyRoute(() => import('./pages/home/home'));
const Apprentissage = lazyRoute(() => import('./pages/home/apprentissage/Apprentissage'));
const Routines = lazyRoute(() => import('./pages/home/routines/Routines'));
const Todos = lazyRoute(() => import('./pages/home/todos/Todos'));
const Domaines = lazyRoute(() => import('./pages/home/domaines/Domaines'));
const CarteMentale = lazyRoute(() => import('./pages/home/productivite/carte-mentale/CarteMentale'));
const Notes = lazyRoute(() => import('./pages/home/productivite/notes/Notes'));
const Debat = lazyRoute(() => import('./pages/home/productivite/debat/Debat'));
const MarkdownHome = lazyRoute(() => import('./pages/home/productivite/markdown/MarkdownHome'));
const MarkdownDomainPage = lazyRoute(() => import('./pages/home/productivite/markdown/MarkdownDomainPage'));
const MarkdownChapterPage = lazyRoute(() => import('./pages/home/productivite/markdown/MarkdownChapterPage'));
const About = lazyRoute(() => import('./pages/about/about'));
const Settings = lazyRoute(() => import('./pages/settings/Settings'));
const Pricing = lazyRoute(() => import('./pages/pricing/Pricing'));
const PlanPayment = lazyRoute(() => import('./pages/pricing/PlanPayment'));
const PlanSuccess = lazyRoute(() => import('./pages/pricing/PlanSuccess'));
const Login = lazyRoute(() => import('./pages/auth/Login'));
const Register = lazyRoute(() => import('./pages/auth/Register'));
const VerifyEmail = lazyRoute(() => import('./pages/auth/VerifyEmail'));
const Onboarding = lazyRoute(() => import('./pages/onboarding/Onboarding'));
const AdminPanel = lazyRoute(() => import('./pages/admin/AdminPanel'));
const LandingPage = lazyRoute(() => import('./pages/landing/LandingPage'));
const DemoHome = lazyRoute(() => import('./pages/demo/home'));

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" errorElement={<ErrorBoundary />}>
      <Route index element={<IndexRedirect />} />
      <Route path="landingpage" element={<Navigate to="/" replace />} />
      <Route
        path="login"
        element={
          <GuestRoute>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center" />}>
              <Login />
            </Suspense>
          </GuestRoute>
        }
      />
      <Route
        path="register"
        element={
          <GuestRoute>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center" />}>
              <Register />
            </Suspense>
          </GuestRoute>
        }
      />
      <Route
        path="verify-email"
        element={
          <GuestRoute>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center" />}>
              <VerifyEmail />
            </Suspense>
          </GuestRoute>
        }
      />
      <Route
        path="onboarding"
        element={
          <ProtectedRoute>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center" />}>
              <Onboarding />
            </Suspense>
          </ProtectedRoute>
        }
        loader={onboardingLoader}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="home" element={<HomeLayout />}>
          <Route
            index
            element={
              <Suspense fallback={<HomeSkeleton />}>
                <Home />
              </Suspense>
            }
            loader={homeLoader}
          />
          <Route
            path="apprentissage"
            element={
              <Suspense fallback={<ApprentissageSkeleton />}>
                <Apprentissage />
              </Suspense>
            }
            loader={apprentissageLoader}
          />
          <Route
            path="todos"
            element={
              <Suspense fallback={<TodosSkeleton />}>
                <Todos />
              </Suspense>
            }
          />
          <Route
            path="routines"
            element={
              <Suspense fallback={<RoutinesSkeleton />}>
                <Routines />
              </Suspense>
            }
          />
          <Route
            path="domaines"
            element={
              <Suspense fallback={<DomainesSkeleton />}>
                <Domaines />
              </Suspense>
            }
            loader={domainesLoader}
          />
          <Route
            path="productivite/carte-mentale"
            element={
              <Suspense fallback={<CarteMentaleSkeleton />}>
                <CarteMentale />
              </Suspense>
            }
            loader={carteMentaleLoader}
          />
          <Route
            path="productivite/carte-mentale/:deckId"
            element={
              <Suspense fallback={<CarteMentaleSkeleton />}>
                <CarteMentale />
              </Suspense>
            }
            loader={carteMentaleLoader}
          />
          <Route
            path="productivite/notes"
            element={
              <Suspense fallback={<NotesSkeleton />}>
                <Notes />
              </Suspense>
            }
            loader={notesLoader}
          />
          <Route
            path="productivite/debat"
            element={
              <Suspense fallback={<DebatSkeleton />}>
                <Debat />
              </Suspense>
            }
            loader={debatLoader}
          />
          <Route
            path="productivite/debat/:debateId"
            element={
              <Suspense fallback={<DebatSkeleton />}>
                <Debat />
              </Suspense>
            }
            loader={debatLoader}
          />
          <Route
            path="productivite/markdown"
            element={
              <Suspense fallback={<MarkdownSkeleton />}>
                <MarkdownHome />
              </Suspense>
            }
            loader={markdownHomeLoader}
          />
          <Route
            path="productivite/markdown/domain/:domainId"
            element={
              <Suspense fallback={<MarkdownSkeleton />}>
                <MarkdownDomainPage />
              </Suspense>
            }
            loader={markdownDomainLoader}
          />
          <Route
            path="productivite/markdown/domain/:domainId/chapter/:chapterId"
            element={
              <Suspense fallback={<MarkdownSkeleton />}>
                <MarkdownChapterPage />
              </Suspense>
            }
            loader={markdownChapterLoader}
          />
        </Route>
        <Route
          path="about"
          element={
            <Suspense fallback={<AboutSkeleton />}>
              <About />
            </Suspense>
          }
          loader={aboutLoader}
        />
        <Route
          path="plan"
          element={
            <Suspense fallback={<PricingSkeleton />}>
              <Pricing />
            </Suspense>
          }
        />
        <Route
          path="plan/payment/:planId"
          element={
            <Suspense fallback={<PricingSkeleton />}>
              <PlanPayment />
            </Suspense>
          }
        />
        <Route
          path="plan/success"
          element={
            <Suspense fallback={<PricingSkeleton />}>
              <PlanSuccess />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<SettingsSkeleton />}>
              <Settings />
            </Suspense>
          }
        />
        <Route
          path="admin"
          element={
            <Suspense fallback={<SettingsSkeleton />}>
              <AdminPanel />
            </Suspense>
          }
        />
      </Route>
      {/* Routes démo - sans authentification */}
      <Route
        path="/demo"
        element={<DemoLayout />}
      >
        <Route index element={<Navigate to="/demo/home" replace />} />
        <Route path="home" element={<HomeLayout />}>
          <Route
            index
            element={
              <Suspense fallback={<HomeSkeleton />}>
                <DemoHome />
              </Suspense>
            }
            loader={demoHomeLoader}
          />
          <Route
            path="apprentissage"
            element={
              <Suspense fallback={<ApprentissageSkeleton />}>
                <Apprentissage />
              </Suspense>
            }
            loader={demoApprentissageLoader}
          />
          <Route
            path="todos"
            element={
              <Suspense fallback={<TodosSkeleton />}>
                <Todos />
              </Suspense>
            }
          />
          <Route
            path="routines"
            element={
              <Suspense fallback={<RoutinesSkeleton />}>
                <Routines />
              </Suspense>
            }
          />
          <Route
            path="domaines"
            element={
              <Suspense fallback={<DomainesSkeleton />}>
                <Domaines />
              </Suspense>
            }
            loader={demoDomainesLoader}
          />
          <Route
            path="productivite/carte-mentale"
            element={
              <Suspense fallback={<CarteMentaleSkeleton />}>
                <CarteMentale />
              </Suspense>
            }
            loader={demoCarteMentaleLoader}
          />
          <Route
            path="productivite/carte-mentale/:deckId"
            element={
              <Suspense fallback={<CarteMentaleSkeleton />}>
                <CarteMentale />
              </Suspense>
            }
            loader={demoCarteMentaleLoader}
          />
          <Route
            path="productivite/notes"
            element={
              <Suspense fallback={<NotesSkeleton />}>
                <Notes />
              </Suspense>
            }
            loader={demoNotesLoader}
          />
          <Route
            path="productivite/debat"
            element={
              <Suspense fallback={<DebatSkeleton />}>
                <Debat />
              </Suspense>
            }
            loader={demoDebatLoader}
          />
          <Route
            path="productivite/debat/:debateId"
            element={
              <Suspense fallback={<DebatSkeleton />}>
                <Debat />
              </Suspense>
            }
            loader={demoDebatLoader}
          />
          <Route
            path="productivite/markdown"
            element={
              <Suspense fallback={<MarkdownSkeleton />}>
                <MarkdownHome />
              </Suspense>
            }
            loader={demoMarkdownHomeLoader}
          />
          <Route
            path="productivite/markdown/domain/:domainId"
            element={
              <Suspense fallback={<MarkdownSkeleton />}>
                <MarkdownDomainPage />
              </Suspense>
            }
            loader={demoMarkdownDomainLoader}
          />
          <Route
            path="productivite/markdown/domain/:domainId/chapter/:chapterId"
            element={
              <Suspense fallback={<MarkdownSkeleton />}>
                <MarkdownChapterPage />
              </Suspense>
            }
            loader={demoMarkdownChapterLoader}
          />
        </Route>
        <Route
          path="plan"
          element={
            <Suspense fallback={<PricingSkeleton />}>
              <Pricing />
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  )
);
