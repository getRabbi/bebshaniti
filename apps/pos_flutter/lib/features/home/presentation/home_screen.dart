import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Business OS POS')),
        body: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text('Today', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 12),
            const Card(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Text(
                  'Live dashboard data activates with the reporting API in Phase 7.',
                ),
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                FilledButton.icon(
                  onPressed: () => context.go('/pos'),
                  icon: const Icon(Icons.point_of_sale),
                  label: const Text('New sale'),
                ),
                OutlinedButton(
                  onPressed: () => context.go('/products'),
                  child: const Text('Products'),
                ),
                OutlinedButton(
                  onPressed: () => context.go('/customers'),
                  child: const Text('Customers'),
                ),
                OutlinedButton(
                  onPressed: () => context.go('/due'),
                  child: const Text('Due / Baki'),
                ),
              ],
            ),
          ],
        ),
      );
}
