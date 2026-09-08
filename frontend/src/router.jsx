import { createBrowserRouter, createRoutesFromElements, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import Layout from './components/Layout';
import DemoLayout from './components/DemoLayout';
import ErrorBoundary from './components/ErrorBoundary';
import lazyRoute from './lib/lazyRoute';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import IndexRedirect from './pages/IndexRedirect';
import HomeLayout from './components/HomeLayout';
import HomeSkeleton from './components/skeletons/HomeSkeleton';
import AboutSkeleton from './components/skeletons/AboutSkeleton';
import TodosSkeleton from './components/skeletons/TodosSkeleton';
import RoutinesSkeleton from './components/skeletons/RoutinesSkeleton';
import FlashcardsSkeleton from './components/skeletons/FlashcardsSkeleton';
import PricingSkeleton from './components/skeletons/PricingSkeleton';
import SettingsSkeleton from './components/skeletons/SettingsSkeleton';
import { aboutLoader } from './loaders/about';
import { homeLoader } from './loaders/home';
import { flashcardsLoader } from './loaders/flashcards';
import { onboardingLoader } from './loaders/onboarding';
import { demoHomeLoader } from './loaders/demo/home';
import { demoFlashcardsLoader } from './loaders/demo/flashcards';

const Home = lazyRoute(() => import('./pages/home/home'));
const Routines = lazyRoute(() => import('./pages/home/routines/Routines'));
const Todos = lazyRoute(() => import('./pages/home/todos/Todos'));
const Flashcards = lazyRoute(() => import('./pages/home/flashcards/Flashcards'));
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
            path="flashcards"
            element={
              <Suspense fallback={<FlashcardsSkeleton />}>
                <Flashcards />
              </Suspense>
            }
            loader={flashcardsLoader}
          />
          <Route
            path="flashcards/:deckId"
            element={
              <Suspense fallback={<FlashcardsSkeleton />}>
                <Flashcards />
              </Suspense>
            }
            loader={flashcardsLoader}
          />
          {/* Ancien emplacement des flashcards : les liens existants restent valides. */}
          <Route path="productivite/carte-mentale" element={<Navigate to="/home/flashcards" replace />} />
          <Route path="productivite/*" element={<Navigate to="/home" replace />} />
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
      <Route path="/demo" element={<DemoLayout />}>
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
            path="flashcards"
            element={
              <Suspense fallback={<FlashcardsSkeleton />}>
                <Flashcards />
              </Suspense>
            }
            loader={demoFlashcardsLoader}
          />
          <Route
            path="flashcards/:deckId"
            element={
              <Suspense fallback={<FlashcardsSkeleton />}>
                <Flashcards />
              </Suspense>
            }
            loader={demoFlashcardsLoader}
          />
          <Route path="productivite/carte-mentale" element={<Navigate to="/demo/home/flashcards" replace />} />
          <Route path="productivite/*" element={<Navigate to="/demo/home" replace />} />
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
