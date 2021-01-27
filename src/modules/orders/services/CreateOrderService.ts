import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExist = await this.customersRepository.findById(customer_id);

    if (!customerExist) {
      throw new AppError('Could not find any customer with this id ');
    }

    const productsExist = await this.productsRepository.findAllById(products);

    if (!productsExist.length) {
      throw new AppError('Could not find products with these ids');
    }

    const productsIds = productsExist.map(product => product.id);

    const checkInexistentProducts = products.filter(
      product => !productsIds.includes(product.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError(
        `Could not find this product: ${checkInexistentProducts[0].id}`,
      );
    }

    const findProductWithoutQuantityAvailable = products.filter(
      product =>
        productsExist.filter(productExist => productExist.id === product.id)[0]
          .quantity < product.quantity,
    );

    if (findProductWithoutQuantityAvailable.length) {
      throw new AppError('The quantity is not available for this product id');
    }

    const serializableProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productsExist.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExist,
      products: serializableProducts,
    });

    const orderedProduct = products.map(product => ({
      id: product.id,
      quantity:
        productsExist.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProduct);

    return order;
  }
}

export default CreateOrderService;
