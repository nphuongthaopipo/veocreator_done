import React from 'react';
import { AppView } from '../types';
import { useAppContext } from '../context/AppContext';

interface UserInfoProps {
    isCollapsed: boolean;
    setActiveView: (view: AppView) => void;
}

const UserInfo: React.FC<UserInfoProps> = ({ isCollapsed, setActiveView }) => {
    const { currentUser } = useAppContext();

    if (isCollapsed) {
        return (
            <div 
                className="p-4 border-t border-gray-200 mt-4 flex justify-center"
                title={currentUser?.user.username || 'Tài khoản'}
                onClick={() => setActiveView(AppView.PROFILE)} // Chuyển đến trang Profile khi click
            >
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                </div>
            </div>
        );
    }
    
    return (
        <div className="p-4 border-t border-gray-200 mt-4">
            <div 
                className="flex items-center cursor-pointer group"
                onClick={() => setActiveView(AppView.PROFILE)} // Chuyển đến trang Profile khi click
            >
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                </div>
                <div>
                    <p className="font-semibold text-light whitespace-nowrap group-hover:text-accent transition-colors">
                        {currentUser?.user.username || 'Demo User'}
                    </p>
                    <p className="text-sm text-dark-text whitespace-nowrap">Gói: Pro</p>
                </div>
            </div>
            <button 
                className="w-full mt-4 bg-accent hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg transition-colors whitespace-nowrap flex items-center justify-center"
                onClick={() => setActiveView(AppView.PACKAGES)} // Chuyển đến trang Packages khi click
            >
                {/* Icon mới cho nút nâng cấp */}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                </svg>
                Nâng Cấp
            </button>
        </div>
    );
};

export default UserInfo;