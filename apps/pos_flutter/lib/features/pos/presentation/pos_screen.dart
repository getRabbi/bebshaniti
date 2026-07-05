import 'package:flutter/material.dart';

class PosScreen extends StatelessWidget {
  const PosScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('New sale')),
        body: const Center(child: Text('Server-calculated sale flow: Phase 3')),
      );
}
