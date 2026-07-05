import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Settings')),
    body: ListView(
      children: [
        ListTile(
          title: const Text('Sign out'),
          leading: const Icon(Icons.logout),
          onTap: () async {
            await Supabase.instance.client.auth.signOut();
            if (context.mounted) context.go('/login');
          },
        ),
      ],
    ),
  );
}
