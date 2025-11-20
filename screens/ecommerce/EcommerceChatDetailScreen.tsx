import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Text,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import moment from 'moment';
import { useChatMessages } from './chat/hooks/useChatMessages';
import { useWebSocket } from './chat/hooks/useWebSocket';
import ChatHeader from './chat/components/ChatHeader';
import ChatMessage from './chat/components/ChatMessage';
import ChatInput from './chat/components/ChatInput';
import OrderListPanel from './chat/components/OrderListPanel';
import OrderDetailSheet from './chat/components/OrderDetailSheet';
import ProductListPanel from './chat/components/ProductListPanel';
import {
  IChatBuyer,
  IWebSocketChatEvent,
  IWebSocketReplyEvent,
} from './chat/types/chat.types';
import { fetchOrders, IOrder } from '../../services/ecommerce/orderService';
import { fetchProducts, IProduct } from '../../services/ecommerce/productService';
import {
  loadingTimeEstimator,
  LoadingEstimate,
  LoadingProgress,
} from '../../services/ecommerce/loadingTimeEstimator';

type ChatDetailRouteParams = {
  msgId: string;
  idEcommerce: number;
  buyer: IChatBuyer;
  platform: string;
};

export default function EcommerceChatDetailScreen() {
  const route = useRoute<RouteProp<{ params: ChatDetailRouteParams }, 'params'>>();
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);

  const { msgId, idEcommerce, buyer, platform } = route.params;

  // Use custom hooks - pass buyer.id for Shopee send message
  const { messages, loading, error, sendMessage, sendImage, sendProduct, refresh } =
    useChatMessages(msgId, idEcommerce, buyer?.id);

  // Order list state
  const [showOrderList, setShowOrderList] = useState(false);
  const [orderListData, setOrderListData] = useState<IOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [cancelOrderFetch, setCancelOrderFetch] = useState(false);

  // Product list state
  const [showProductList, setShowProductList] = useState(false);
  const [productListData, setProductListData] = useState<IProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [cancelProductFetch, setCancelProductFetch] = useState(false);
  const [productLoadingProgress, setProductLoadingProgress] = useState<{
    percentage: number;
    estimatedTime: string;
    remainingTime: string;
    status: string;
  } | null>(null);

  // Loading time estimation state
  const [loadingEstimate, setLoadingEstimate] = useState<LoadingEstimate | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const loadingStartTimeRef = useRef<number>(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Order detail sheet state
  const [selectedOrder, setSelectedOrder] = useState<IOrder | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);

  // WebSocket for real-time updates
  const handleChatReceived = (event: IWebSocketChatEvent) => {
    // Only refresh if this is the current chat
    if (event.msg_id === msgId) {
      console.log('💬 New message in current chat, refreshing...', event);
      refresh();
    }
  };

  const handleReplyReceived = (event: IWebSocketReplyEvent) => {
    // Only refresh if this is the current chat
    if (event.msg_id === msgId) {
      console.log('💬 New reply in current chat, refreshing...', event);
      refresh();
    }
  };

  useWebSocket(handleChatReceived, handleReplyReceived);

  // Initialize loading time estimator
  useEffect(() => {
    loadingTimeEstimator.initialize();
  }, []);

  // Fetch messages on mount
  useEffect(() => {
    refresh();
  }, [msgId, idEcommerce]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Handle back button - navigate back to chat list
  const handleBack = () => {
    // Navigate back to EcommerceChat screen instead of using goBack()
    // This ensures we always go to the chat list, not the main screen
    (navigation as any).navigate('EcommerceChat');
  };

  // Handle send text
  const handleSendText = async (text: string) => {
    await sendMessage(text);
    // Auto-scroll to bottom after sending
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Handle send image
  const handleSendImage = async (imageUri: string) => {
    await sendImage(imageUri);
    // Auto-scroll to bottom after sending
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Handle toggle order list
  const handleToggleOrderList = async () => {
    if (!showOrderList) {
      // Show panel first, then fetch orders
      setShowOrderList(true);
      // Fetch orders (loading indicator will be visible)
      await handleFetchOrders();
    } else {
      // Close panel
      setShowOrderList(false);
    }
  };

  // Start progress tracking
  const startProgressTracking = (estimate: LoadingEstimate) => {
    loadingStartTimeRef.current = Date.now();
    setLoadingEstimate(estimate);

    // Update progress every 500ms
    progressIntervalRef.current = setInterval(() => {
      const progress = loadingTimeEstimator.calculateProgress(
        loadingStartTimeRef.current,
        estimate
      );
      setLoadingProgress(progress);
    }, 500);
  };

  // Stop progress tracking
  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setLoadingProgress(null);
  };

  // Handle fetch orders
  const handleFetchOrders = async () => {
    setLoadingOrders(true);
    setCancelOrderFetch(false);

    // Get initial estimate and start tracking
    const estimate = loadingTimeEstimator.getEstimate();
    startProgressTracking(estimate);

    try {
      console.log('📦 [ChatDetail] Fetching orders for idEcommerce:', idEcommerce);
      console.log('⏱️ [ChatDetail] Estimated loading time:', {
        seconds: estimate.estimatedSeconds,
        range: `${estimate.estimatedRange.min}-${estimate.estimatedRange.max}s`,
        confidence: estimate.confidence,
      });

      // Get date range (last 30 days)
      const endDate = moment().unix();
      const startDate = moment().subtract(30, 'days').unix();

      const result = await fetchOrders(idEcommerce, startDate, endDate);

      // Calculate actual loading time
      const loadingDuration = Date.now() - loadingStartTimeRef.current;

      // Check if user cancelled the fetch
      if (cancelOrderFetch) {
        console.log('⚠️ [ChatDetail] Order fetch cancelled by user');
        setOrderListData([]);
        stopProgressTracking();
        return;
      }

      if (result.status && result.data) {
        console.log('✅ [ChatDetail] Orders fetched:', result.data.length);
        console.log('⏱️ [ChatDetail] Actual loading time:', (loadingDuration / 1000).toFixed(1), 'seconds');

        // Record loading time for future estimates
        await loadingTimeEstimator.recordLoadingTime(result.data.length, loadingDuration);

        // Debug: Log first order to see structure
        if (result.data.length > 0) {
          console.log('📦 [ChatDetail] First order structure:', JSON.stringify(result.data[0], null, 2));

          // Check items/products structure
          const firstOrder = result.data[0];
          const items = firstOrder.items || firstOrder.products || [];
          if (items.length > 0) {
            console.log('📦 [ChatDetail] First item structure:', JSON.stringify(items[0], null, 2));
          }
        }

        // Show ALL orders (same as web version)
        setOrderListData(result.data);
      } else {
        console.log('⚠️ [ChatDetail] No orders found');
        setOrderListData([]);
      }
    } catch (error) {
      console.error('❌ [ChatDetail] Error fetching orders:', error);
      setOrderListData([]);
    } finally {
      stopProgressTracking();
      setLoadingOrders(false);
    }
  };

  // Handle cancel order loading
  const handleCancelOrderLoading = () => {
    console.log('🚫 [ChatDetail] Cancelling order fetch...');
    setCancelOrderFetch(true);
    stopProgressTracking();
    setLoadingOrders(false);
    setShowOrderList(false);
  };

  // Handle order press - show detail sheet
  const handleOrderPress = (order: IOrder) => {
    console.log('📦 [ChatDetail] Order pressed:', order.invoice || order.id);
    setSelectedOrder(order);
    setShowOrderDetail(true);
  };

  // Handle close order detail sheet
  const handleCloseOrderDetail = () => {
    setShowOrderDetail(false);
    setSelectedOrder(null);
  };

  // ============================================
  // PRODUCT LIST FUNCTIONS
  // ============================================

  // Fetch products with time tracking
  const handleFetchProducts = async () => {
    if (loadingProducts || cancelProductFetch) {
      console.log('⚠️ [ChatDetail] Already loading products or cancelled');
      return;
    }

    try {
      setLoadingProducts(true);
      setCancelProductFetch(false);

      console.log('📦 [ChatDetail] Fetching products for idEcommerce:', idEcommerce);

      // Start time tracking
      loadingStartTimeRef.current = Date.now();

      // Get estimate based on historical data
      const estimate = await loadingTimeEstimator.getEstimate(0); // Products don't have count
      setLoadingEstimate(estimate);

      console.log('⏱️ [ChatDetail] Estimated loading time:', {
        estimatedSeconds: estimate.estimatedSeconds,
        confidence: estimate.confidence,
      });

      // Start progress tracking
      progressIntervalRef.current = setInterval(() => {
        if (cancelProductFetch) {
          return;
        }

        const progress = loadingTimeEstimator.calculateProgress(
          loadingStartTimeRef.current,
          estimate
        );

        // Convert LoadingProgress to ProductListPanel format
        setProductLoadingProgress({
          percentage: progress.progressPercentage,
          estimatedTime: `${progress.estimatedTotalSeconds}s`,
          remainingTime: `${progress.estimatedRemainingSeconds}s`,
          status: progress.status,
        });
      }, 500);

      // Fetch products
      const result = await fetchProducts(idEcommerce);

      // Stop progress tracking
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      // Calculate actual loading time in milliseconds
      const actualLoadingTimeMs = Date.now() - loadingStartTimeRef.current;

      console.log('✅ [ChatDetail] Products fetched:', {
        count: result.data.length,
        actualLoadingTime: `${(actualLoadingTimeMs / 1000).toFixed(2)}s`,
      });

      if (result.status) {
        setProductListData(result.data);

        // Save loading time for future estimates (duration in ms, count)
        await loadingTimeEstimator.recordLoadingTime(result.data.length, actualLoadingTimeMs);
      } else {
        console.error('❌ [ChatDetail] Failed to fetch products:', result.message);
      }
    } catch (error: any) {
      console.error('❌ [ChatDetail] Error fetching products:', error);

      // Stop progress tracking on error
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    } finally {
      setLoadingProducts(false);
      setLoadingEstimate(null);
      setProductLoadingProgress(null);
    }
  };

  // Cancel product loading
  const handleCancelProductLoading = () => {
    console.log('❌ [ChatDetail] Cancelling product fetch...');
    setCancelProductFetch(true);
    setLoadingProducts(false);
    setShowProductList(false);
    setLoadingEstimate(null);
    setProductLoadingProgress(null);

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // Toggle product list panel
  const handleToggleProductList = () => {
    console.log('📦 [ChatDetail] Toggle product list, current state:', showProductList);

    if (!showProductList) {
      // Show panel first, then fetch
      setShowProductList(true);
      handleFetchProducts();
    } else {
      // Close panel
      setShowProductList(false);
    }
  };

  // Handle product press - send product message
  const handleProductPress = async (product: IProduct) => {
    console.log('📦 [ChatDetail] Product selected:', {
      id: product.id,
      product_id: product.product_id,
      nama: product.nama,
    });

    // Use product_id if available, otherwise use id
    const productId = product.product_id || product.id.toString();

    // Send product message
    await sendProduct(productId);

    console.log('✅ [ChatDetail] Product message sent, panel will close');

    // Close product panel
    setShowProductList(false);
  };

  // Render empty state
  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptySubtext}>Start the conversation!</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.innerContainer}>
        {/* Header */}
        <ChatHeader buyer={buyer} platform={platform} onBack={handleBack} />

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={({ item }) => (
            <ChatMessage message={item} isCurrentUser={item.from === 'seller'} />
          )}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={
            messages.length === 0 ? styles.emptyList : styles.messagesList
          }
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        {/* Order List Panel */}
        <OrderListPanel
          visible={showOrderList}
          orders={orderListData}
          loading={loadingOrders}
          loadingProgress={loadingProgress}
          onClose={() => setShowOrderList(false)}
          onOrderPress={handleOrderPress}
          onCancelLoading={handleCancelOrderLoading}
        />

        {/* Product List Panel */}
        <ProductListPanel
          visible={showProductList}
          products={productListData}
          loading={loadingProducts}
          loadingProgress={productLoadingProgress}
          onClose={() => setShowProductList(false)}
          onProductPress={handleProductPress}
          onCancelLoading={handleCancelProductLoading}
        />

        {/* Input */}
        <ChatInput
          onSendText={handleSendText}
          onSendImage={handleSendImage}
          onToggleOrderList={handleToggleOrderList}
          onToggleProductList={handleToggleProductList}
          disabled={loading}
        />
      </View>

      {/* Order Detail Sheet */}
      <OrderDetailSheet
        visible={showOrderDetail}
        order={selectedOrder}
        onClose={handleCloseOrderDetail}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 28,
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  innerContainer: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: 8,
  },
  emptyList: {
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
});

