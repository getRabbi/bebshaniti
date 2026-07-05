import 'package:flutter/material.dart';

ThemeData buildTheme() {
  const brand = Color(0xFF087F5B);
  return ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: brand),
    useMaterial3: true,
    scaffoldBackgroundColor: const Color(0xFFF4F7F5),
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(),
    ),
  );
}
