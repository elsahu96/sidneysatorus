import apiClient from '@/lib/api';

export interface User {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}

export const userService = {
    // Get all users
    async getUsers(): Promise<User[]> {
        const response = await apiClient.get<{ users: User[] }>('/api/users');
        return response.users;
    },

    // Get single user
    async getUser(id: string): Promise<User> {
        const response = await apiClient.get<{ user: User }>(`/api/users/${id}`);
        return response.user;
    },

    // Create user
    async createUser(data: { email: string; name: string }): Promise<User> {
        const response = await apiClient.post<{ user: User }>('/api/users', data);
        return response.user;
    },

    // Update user
    async updateUser(id: string, data: Partial<User>): Promise<User> {
        const response = await apiClient.put<{ user: User }>(`/api/users/${id}`, data);
        return response.user;
    },

    // Delete user
    async deleteUser(id: string): Promise<void> {
        await apiClient.delete(`/api/users/${id}`);
    },
};