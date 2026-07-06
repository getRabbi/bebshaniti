import 'package:flutter/material.dart';

class DueScreen extends StatelessWidget {
  const DueScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Due / Baki')),
        body: const Center(
          child: Text('Append-only due ledger integration: Phase 4'),
        ),
      );
}
