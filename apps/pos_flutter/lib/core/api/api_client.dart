import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class ApiClient {
  ApiClient({required String baseUrl, required SupabaseClient supabase})
      : _supabase = supabase,
        _dio = Dio(
          BaseOptions(
            baseUrl: baseUrl,
            connectTimeout: const Duration(seconds: 10),
          ),
        ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _supabase.auth.currentSession?.accessToken;
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
          if (_organizationId != null) {
            options.headers['X-Organization-ID'] = _organizationId;
          }
          handler.next(options);
        },
      ),
    );
  }

  final Dio _dio;
  final SupabaseClient _supabase;
  String? _organizationId;

  void selectOrganization(String organizationId) =>
      _organizationId = organizationId;

  Future<Response<Map<String, dynamic>>> get(String path) =>
      _dio.get<Map<String, dynamic>>(path);
}
