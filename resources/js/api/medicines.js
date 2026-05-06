import api from './axios';

export function listMedicinesFromInventory() {
    return api.get('/medicines');
}
