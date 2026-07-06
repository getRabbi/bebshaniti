import 'package:bd_business_os_pos/core/config/environment.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('local environment is the safe default', () {
    expect(Environment.appEnv, 'local');
  });
}
