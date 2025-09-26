// src/services/authService.ts

// URL API trỏ đến website của bạn
const API_URL = 'https://mmoreal.com/api'; 

/**
 * Gửi yêu cầu đăng nhập đến API.
 * @param email - Email của người dùng (kiểu string)
 * @param password - Mật khẩu của người dùng (kiểu string)
 */
export const login = async (email: string, password: string) => {
  const response = await fetch(`${API_URL}/login.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
};

/**
 * Lấy thông tin hồ sơ người dùng từ API.
 * @param token - Token xác thực (kiểu string)
 */
export const fetchProfile = async (token: string) => {
    // Bỏ userId khỏi URL, server sẽ tự lấy từ token
    const response = await fetch(`${API_URL}/profile.php`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.json();
}

/**
 * Gửi yêu cầu đăng ký tài khoản mới.
 * @param username Tên đăng nhập
 * @param email Email
 * @param password Mật khẩu
 */
export const register = async (username: string, email: string, password: string) => {
  const response = await fetch(`${API_URL}/register.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, email, password }),
  });
  return response.json();
};

/**
 * Lấy danh sách các gói cước từ API.
 */
export const fetchPackages = async () => {
    const response = await fetch(`${API_URL}/packages.php`);
    return response.json();
}

/**
 * Lấy thông tin cài đặt thanh toán từ server.
 */
export const fetchPaymentSettings = async () => {
    const response = await fetch(`${API_URL}/get_payment_settings.php`);
    return response.json();
};

/**
 * Tạo một giao dịch mới khi người dùng xác nhận đã thanh toán.
 */
export const createTransaction = async (transactionData: any, token: string) => {
    const response = await fetch(`${API_URL}/create_transaction.php`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Gửi token để xác thực nếu cần
        },
        body: JSON.stringify(transactionData),
    });
    return response.json();
};

/**
 * Lấy lịch sử giao dịch của người dùng.
 */
export const fetchTransactionHistory = async (userId: number, token: string) => {
    const response = await fetch(`${API_URL}/get_transaction_history.php?userId=${userId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.json();
};

/**
 * Cập nhật thông tin hồ sơ người dùng.
 */
export const updateProfile = async (updateData: any, token: string) => {
    const response = await fetch(`${API_URL}/update_profile.php`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData),
    });
    return response.json();
};