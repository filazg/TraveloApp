import axios from 'axios'
import { backendURL } from '../config/config'

export const api = axios.create({
  baseURL: backendURL,
  withCredentials: true,
})
