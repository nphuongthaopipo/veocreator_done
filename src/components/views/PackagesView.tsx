import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchPaymentSettings, fetchTransactionHistory } from '../../services/authService';
import PaymentModal from '../common/PaymentModal';
import Spinner from '../common/Spinner';
import { useAppContext } from '../../context/AppContext';
import { Transaction } from '../../types'; // Import kiểu Transaction

// Định nghĩa kiểu dữ liệu cho một gói cước
interface Package {
    id: string;
    name: string;
    price: number;
    durationLabel: string;
    description: string;
    originalPrice?: number;
    isFeatured?: boolean;
}

// Định nghĩa kiểu dữ liệu cho thông tin thanh toán
interface PaymentInfo {
    vietqr_bank_id?: string;
    vietqr_bank_name?: string;
    vietqr_account_holder?: string;
    vietqr_account_number?: string;
    zalo_contact?: string;
}

const PackagesView: React.FC = () => {
    const { showToast } = useToast();
    const { currentUser } = useAppContext(); // Lấy thông tin người dùng hiện tại
    const [customMonths, setCustomMonths] = useState<number>(3);
    const [packages, setPackages] = useState<Package[]>([]);
    
    // State cho modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
    const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);

    // State mới cho lịch sử giao dịch
    const [history, setHistory] = useState<Transaction[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    const MONTHLY_PRICE = 399000;

    // Lấy thông tin thanh toán và lịch sử giao dịch khi component được tải
    useEffect(() => {
        // Lấy thông tin thanh toán
        fetchPaymentSettings().then(res => {
            if (res.success) {
                setPaymentInfo(res.data);
            } else {
                showToast('Không thể tải thông tin thanh toán.', 'error');
            }
        });

        // Lấy lịch sử giao dịch
        if (currentUser) {
            setIsLoadingHistory(true);
            fetchTransactionHistory(currentUser.user.id, currentUser.token)
                .then(res => {
                    if (res.success) {
                        setHistory(res.data);
                    }
                })
                .catch(() => showToast('Không thể tải lịch sử giao dịch.', 'error'))
                .finally(() => setIsLoadingHistory(false));
        }
    }, [currentUser, showToast]);


    // Tính toán giá các gói
    useEffect(() => {
        const calculatePackages = () => {
            const oneYearPrice = (MONTHLY_PRICE * 12) * 0.80;
            const customPrice = (MONTHLY_PRICE * customMonths) * 0.90;
            const updatedPackages: Package[] = [
                { id: '1m', name: 'Gói 1 Tháng', price: MONTHLY_PRICE, durationLabel: '/ tháng', description: 'Phù hợp để trải nghiệm tất cả các tính năng cơ bản.' },
                { id: '1y', name: 'Gói 1 Năm', price: oneYearPrice, originalPrice: MONTHLY_PRICE * 12, durationLabel: '/ năm', description: 'Lựa chọn tiết kiệm nhất cho người dùng lâu dài.', isFeatured: true },
                { id: 'life', name: 'Gói Vĩnh Viễn', price: 5000000, durationLabel: 'mãi mãi', description: 'Thanh toán một lần, sử dụng không giới hạn thời gian.' },
                { id: 'custom', name: 'Gói Tùy Chỉnh', price: customPrice, originalPrice: MONTHLY_PRICE * customMonths, durationLabel: `/ ${customMonths} tháng`, description: 'Linh hoạt lựa chọn thời gian sử dụng phù hợp.' }
            ];
            setPackages(updatedPackages);
        };
        calculatePackages();
    }, [customMonths]);

    const handlePurchase = (pkg: Package) => {
        setSelectedPackage(pkg);
        setIsModalOpen(true);
    };

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
    };

    const renderStatusBadge = (status: string) => {
        const statusClasses: { [key: string]: string } = {
            completed: 'bg-green-100 text-green-800',
            pending: 'bg-yellow-100 text-yellow-800',
            failed: 'bg-red-100 text-red-800',
            cancelled: 'bg-gray-100 text-gray-800',
        };
        return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusClasses[status] || 'bg-gray-100'}`}>{status}</span>;
    };


    return (
        <div className="animate-fade-in">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-light mb-2">Chọn gói phù hợp với bạn</h1>
                <p className="text-dark-text mb-10">Mở khóa toàn bộ tiềm năng sáng tạo với các gói cước của chúng tôi.</p>
            </div>
            
            {/* Phần hiển thị các gói */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {packages.map(pkg => (
                    <div 
                        key={pkg.id} 
                        className={`bg-secondary p-6 rounded-lg shadow-lg flex flex-col transition-transform hover:-translate-y-2 ${pkg.isFeatured ? 'border-2 border-accent' : 'border border-border-color'}`}
                    >
                        <h2 className="text-2xl font-bold text-light">{pkg.name}</h2>
                        <p className="text-dark-text mt-2 flex-grow">{pkg.description}</p>
                        
                        {pkg.id === 'custom' && (
                            <div className="my-6">
                                <label className="font-bold text-dark-text">Chọn số tháng:</label>
                                <input type="range" min="2" max="11" value={customMonths} onChange={(e) => setCustomMonths(parseInt(e.target.value))} className="w-full h-2 bg-primary rounded-lg appearance-none cursor-pointer mt-2" />
                                <div className="text-center font-bold text-accent text-lg mt-1">{customMonths} tháng</div>
                            </div>
                        )}

                        <div className="my-6">
                            {pkg.originalPrice && (<p className="text-dark-text line-through">{formatCurrency(pkg.originalPrice)}</p>)}
                            <p className="text-4xl font-extrabold my-2 text-light">{formatCurrency(pkg.price)}</p>
                            <p className="font-semibold text-dark-text">{pkg.durationLabel}</p>
                        </div>
                        
                        <button 
                            onClick={() => handlePurchase(pkg)}
                            className={`w-full font-bold py-3 px-4 rounded-lg transition-colors mt-auto ${pkg.isFeatured ? 'bg-accent hover:bg-indigo-500 text-white' : 'bg-primary hover:bg-gray-200 text-accent'}`}
                        >
                            Chọn gói
                        </button>
                    </div>
                ))}
            </div>

            {/* Phần hiển thị lịch sử giao dịch */}
            <div className="mt-12 bg-secondary p-6 rounded-lg shadow-lg">
                <h3 className="text-2xl font-bold text-light mb-4">Lịch sử giao dịch của bạn</h3>
                <div className="overflow-x-auto">
                    {isLoadingHistory ? (
                        <div className="flex justify-center p-4"><Spinner /></div>
                    ) : history.length === 0 ? (
                        <p className="text-dark-text text-center p-4">Bạn chưa có giao dịch nào.</p>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-dark-text uppercase bg-primary">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Gói</th>
                                    <th scope="col" className="px-6 py-3">Mô tả/Mã GD</th>
                                    <th scope="col" className="px-6 py-3">Số tiền</th>
                                    <th scope="col" className="px-6 py-3">Ngày</th>
                                    <th scope="col" className="px-6 py-3">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(tx => (
                                    <tr key={tx.transaction_id} className="border-b border-border-color hover:bg-primary">
                                        <td className="px-6 py-4 font-medium text-light">{tx.package_name}</td>
                                        <td className="px-6 py-4 text-dark-text font-mono">{tx.description}</td>
                                        <td className="px-6 py-4 text-dark-text">{parseInt(tx.amount).toLocaleString('vi-VN')} {tx.currency}</td>
                                        <td className="px-6 py-4 text-dark-text">{new Date(tx.transaction_date).toLocaleString('vi-VN')}</td>
                                        <td className="px-6 py-4">{renderStatusBadge(tx.payment_status)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            
            {/* Component Modal */}
            <PaymentModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                selectedPackage={selectedPackage}
                paymentInfo={paymentInfo}
            />
        </div>
    );
};

export default PackagesView;