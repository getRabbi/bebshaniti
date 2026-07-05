import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/router.dart';
import 'app/theme.dart';
import 'core/config/environment.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  Environment.validate();
  await Supabase.initialize(
    url: Environment.supabaseUrl,
    anonKey: Environment.supabaseAnonKey,
  );
  runApp(const ProviderScope(child: PosApp()));
}

class PosApp extends StatelessWidget {
  const PosApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp.router(
    title: 'Business OS POS',
    debugShowCheckedModeBanner: Environment.appEnv != 'production',
    theme: buildTheme(),
    routerConfig: buildRouter(),
  );
}
