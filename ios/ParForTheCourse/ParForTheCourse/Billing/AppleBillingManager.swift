import Foundation
import Combine
import StoreKit

@MainActor
final class AppleBillingManager: ObservableObject {
	static let productIDs = [
		"com.parforthecourse.app.edition.classic",
		"com.parforthecourse.app.edition.reracked",
		"com.parforthecourse.app.edition.sequential",
		"com.parforthecourse.app.edition.tournament",
		"com.parforthecourse.app.edition.teedoff",
		"com.parforthecourse.app.edition.bundle",
	]

	private(set) var products: [Product] = []
	private var transactions: [String: Transaction] = [:]
	private var updatesTask: Task<Void, Never>?
	var emit: (([String: Any]) -> Void)?

	init() {
		updatesTask = Task { [weak self] in
			for await result in Transaction.updates {
				await self?.handleTransactionUpdate(result)
			}
		}
	}

	func handle(_ message: [String: Any]) async {
		guard
			let action = message["action"] as? String,
			let requestId = message["requestId"] as? String,
			!requestId.isEmpty
		else {
			return
		}

		switch action {
		case "queryProducts":
			await queryProducts(requestId: requestId)
		case "purchase":
			await purchase(message["productId"] as? String ?? "", requestId: requestId)
		case "sync":
			await sync(restore: message["restore"] as? Bool ?? false, requestId: requestId)
		case "finish":
			await finish(message["transactionId"] as? String ?? "", requestId: requestId)
		default:
			emitResult(type: "request_result", requestId: requestId, payload: [
				"ok": false,
				"message": "Unsupported Apple billing action.",
			])
		}
	}

	private func queryProducts(requestId: String) async {
		do {
			products = try await Product.products(for: Self.productIDs)
				.filter { $0.type == .nonConsumable }
			let byId = Dictionary(uniqueKeysWithValues: products.map { ($0.id, $0) })
			let orderedProducts = Self.productIDs.compactMap { byId[$0] }
			emitResult(type: "catalog_result", requestId: requestId, payload: [
				"ok": true,
				"products": orderedProducts.map { product in
					[
						"productId": product.id,
						"available": true,
						"title": product.displayName,
						"description": product.description,
						"formattedPrice": product.displayPrice,
						"priceCurrencyCode": NSNull(),
						"priceAmountMicros": NSNull(),
					]
				},
			])
		} catch {
			emitResult(type: "catalog_result", requestId: requestId, payload: [
				"ok": false,
				"message": "Unable to load App Store products.",
			])
		}
	}

	private func purchase(_ productId: String, requestId: String) async {
		guard Self.productIDs.contains(productId) else {
			emitResult(type: "purchase_result", requestId: requestId, payload: [
				"ok": false,
				"status": "failed",
				"message": "Unsupported App Store product.",
			])
			return
		}

		do {
			if !products.contains(where: { $0.id == productId }) {
				products = try await Product.products(for: Self.productIDs)
					.filter { $0.type == .nonConsumable }
			}
			guard let product = products.first(where: { $0.id == productId }) else {
				throw BillingError.productUnavailable
			}

			switch try await product.purchase() {
			case .success(let result):
				guard case .verified(let transaction) = result else {
					throw BillingError.unverifiedTransaction
				}
				transactions[String(transaction.id)] = transaction
				emitResult(type: "purchase_result", requestId: requestId, payload: transactionPayload(transaction))
			case .pending:
				emitResult(type: "purchase_result", requestId: requestId, payload: [
					"ok": true,
					"status": "pending",
				])
			case .userCancelled:
				emitResult(type: "purchase_result", requestId: requestId, payload: [
					"ok": true,
					"status": "cancelled",
				])
			@unknown default:
				throw BillingError.unknownPurchaseResult
			}
		} catch {
			emitResult(type: "purchase_result", requestId: requestId, payload: [
				"ok": false,
				"status": "failed",
				"message": "App Store purchase could not be completed.",
			])
		}
	}

	private func sync(restore: Bool, requestId: String) async {
		do {
			if restore {
				try await AppStore.sync()
			}

			var verifiedTransactions: [UInt64: Transaction] = [:]
			var unfinishedTransactionIDs = Set<UInt64>()
			for await result in Transaction.currentEntitlements {
				if case .verified(let transaction) = result, Self.productIDs.contains(transaction.productID) {
					verifiedTransactions[transaction.id] = transaction
				}
			}
			for await result in Transaction.unfinished {
				if case .verified(let transaction) = result, Self.productIDs.contains(transaction.productID) {
					verifiedTransactions[transaction.id] = transaction
					unfinishedTransactionIDs.insert(transaction.id)
				}
			}

			let records = verifiedTransactions.values
				.sorted { $0.purchaseDate < $1.purchaseDate }
				.map { transaction -> [String: Any] in
					transactions[String(transaction.id)] = transaction
					return transactionPayload(
						transaction,
						unfinished: unfinishedTransactionIDs.contains(transaction.id)
					)
				}
			emitResult(type: "sync_result", requestId: requestId, payload: [
				"ok": true,
				"transactions": records,
			])
		} catch {
			emitResult(type: "sync_result", requestId: requestId, payload: [
				"ok": false,
				"message": restore ? "Unable to restore App Store purchases." : "Unable to refresh App Store purchases.",
			])
		}
	}

	private func finish(_ transactionId: String, requestId: String) async {
		guard let transaction = transactions[transactionId] else {
			emitResult(type: "finish_result", requestId: requestId, payload: [
				"ok": false,
				"message": "Transaction is no longer available to finish.",
			])
			return
		}
		await transaction.finish()
		transactions.removeValue(forKey: transactionId)
		emitResult(type: "finish_result", requestId: requestId, payload: ["ok": true])
	}

	private func handleTransactionUpdate(_ result: VerificationResult<Transaction>) async {
		guard case .verified(let transaction) = result,
			Self.productIDs.contains(transaction.productID)
		else {
			return
		}
		transactions[String(transaction.id)] = transaction
		emitResult(
			type: "transaction_update",
			requestId: "update-\(transaction.id)",
			payload: transactionPayload(transaction)
		)
	}

	private func transactionPayload(_ transaction: Transaction, unfinished: Bool = true) -> [String: Any] {
		[
			"ok": true,
			"status": "purchased",
			"productId": transaction.productID,
			"transactionId": String(transaction.id),
			"signedTransaction": transaction.jwsRepresentation,
			"unfinished": unfinished,
		]
	}

	private func emitResult(type: String, requestId: String, payload: [String: Any]) {
		emit?(["type": type, "requestId": requestId, "payload": payload])
	}

	private enum BillingError: Error {
		case productUnavailable
		case unverifiedTransaction
		case unknownPurchaseResult
	}
}
