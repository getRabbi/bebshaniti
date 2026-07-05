import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../features/auth/presentation/login_screen.dart';
import '../features/customers/presentation/customers_screen.dart';
import '../features/due/presentation/due_screen.dart';
import '../features/home/presentation/home_screen.dart';
import '../features/pos/presentation/pos_screen.dart';
import '../features/products/presentation/products_screen.dart';
import '../features/settings/presentation/settings_screen.dart';

GoRouter buildRouter() => GoRouter(
  initialLocation: Supabase.instance.client.auth.currentSession == null
      ? '/login'
      : '/',
  redirect: (context, state) {
    final signedIn = Supabase.instance.client.auth.currentSession != null;
    if (!signedIn && state.matchedLocation != '/login') return '/login';
    if (signedIn && state.matchedLocation == '/login') return '/';
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
    GoRoute(path: '/products', builder: (_, __) => const ProductsScreen()),
    GoRoute(path: '/pos', builder: (_, __) => const PosScreen()),
    GoRoute(path: '/customers', builder: (_, __) => const CustomersScreen()),
    GoRoute(path: '/due', builder: (_, __) => const DueScreen()),
    GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
  ],
);
